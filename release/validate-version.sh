#!/bin/bash

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/release.conf"

if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to validate the release version." >&2
    exit 1
fi

if [[ ! "$CAPROVER_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Invalid CapRover version: $CAPROVER_VERSION" >&2
    exit 1
fi

ESCAPED_CAPROVER_VERSION="${CAPROVER_VERSION//./\\.}"
if ! grep --extended-regexp --quiet "^## \[$ESCAPED_CAPROVER_VERSION\]( |$)" CHANGELOG.md; then
    echo "CHANGELOG.md is missing the heading ## [$CAPROVER_VERSION]." >&2
    exit 1
fi

GIT_TAG="v$CAPROVER_VERSION"
if git ls-remote --exit-code --tags origin "refs/tags/$GIT_TAG" >/dev/null 2>&1; then
    echo "Tag $GIT_TAG already exists in GitHub." >&2
    exit 1
else
    TAG_LOOKUP_STATUS=$?
    if [ "$TAG_LOOKUP_STATUS" -ne 2 ]; then
        echo "Could not check whether tag $GIT_TAG exists." >&2
        exit "$TAG_LOOKUP_STATUS"
    fi
fi

TAG_URL="https://hub.docker.com/v2/repositories/${CAPROVER_IMAGE_NAME}/tags/${CAPROVER_VERSION}"
HTTP_STATUS="$(curl --silent --show-error --location --output /dev/null --write-out '%{http_code}' "$TAG_URL")"

case "$HTTP_STATUS" in
    200)
        echo "Version $CAPROVER_VERSION already exists on Docker Hub." >&2
        exit 1
        ;;
    404)
        echo "Version $CAPROVER_VERSION is available."
        ;;
    *)
        echo "Docker Hub returned HTTP $HTTP_STATUS while validating version $CAPROVER_VERSION." >&2
        exit 1
        ;;
esac
