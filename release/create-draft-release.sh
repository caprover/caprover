#!/bin/bash

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/release.conf"

RELEASE_NOTES="$(
    awk -v version="$CAPROVER_VERSION" '
        BEGIN { heading = "## [" version "]" }
        index($0, heading) == 1 { capture = 1 }
        capture && /^## \[/ && index($0, heading) != 1 { exit }
        capture { sub(/\r$/, ""); print }
    ' CHANGELOG.md
)"

if [ -z "$CAPROVER_VERSION" ] || [ -z "$RELEASE_NOTES" ]; then
    echo "Could not find the current version or its changelog section."
    exit 1
fi

TAG_NAME="v${CAPROVER_VERSION}"

if git ls-remote --exit-code --tags origin "refs/tags/${TAG_NAME}" >/dev/null 2>&1; then
    git fetch --force origin "refs/tags/${TAG_NAME}:refs/tags/${TAG_NAME}"
    TAG_SHA="$(git rev-list -n 1 "$TAG_NAME")"

    if [ "$TAG_SHA" != "$GITHUB_SHA" ]; then
        echo "Tag ${TAG_NAME} points to ${TAG_SHA}, expected ${GITHUB_SHA}."
        exit 1
    fi
else
    TAG_LOOKUP_STATUS=$?
    if [ "$TAG_LOOKUP_STATUS" -ne 2 ]; then
        echo "Could not check whether tag ${TAG_NAME} exists."
        exit "$TAG_LOOKUP_STATUS"
    fi
fi

if gh release view "$TAG_NAME" >/dev/null 2>&1; then
    echo "Release ${TAG_NAME} already exists."
    exit 0
fi

gh release create "$TAG_NAME" \
    --target "$GITHUB_SHA" \
    --title "$TAG_NAME" \
    --notes "$RELEASE_NOTES" \
    --draft
