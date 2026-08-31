#!/bin/bash

set -e
set -o pipefail

IMAGE_NAME="${1:-}"

if [ "$#" -ne 1 ] || [ -z "$IMAGE_NAME" ]; then
    echo "Usage: $0 <image-name>" >&2
    exit 1
fi

if ! command -v curl >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    echo "curl and jq are required to validate the release version." >&2
    exit 1
fi

CAPROVER_VERSION="$(sed -n "s/^[[:space:]]*version: '\([^']*\)',/\1/p" src/utils/CaptainConstants.ts)"

if [[ ! "$CAPROVER_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Invalid CapRover version: $CAPROVER_VERSION" >&2
    exit 1
fi

version_is_greater() {
    local left_major left_minor left_patch
    local right_major right_minor right_patch

    IFS=. read -r left_major left_minor left_patch <<< "$1"
    IFS=. read -r right_major right_minor right_patch <<< "$2"

    if ((10#$left_major != 10#$right_major)); then
        ((10#$left_major > 10#$right_major))
        return
    fi

    if ((10#$left_minor != 10#$right_minor)); then
        ((10#$left_minor > 10#$right_minor))
        return
    fi

    ((10#$left_patch > 10#$right_patch))
}

TAGS_URL="https://hub.docker.com/v2/repositories/${IMAGE_NAME}/tags?page_size=100"
HIGHEST_TAG=''

while [ -n "$TAGS_URL" ]; do
    TAGS_RESPONSE="$(curl --fail --silent --show-error --location "$TAGS_URL")"

    if ! jq -e '.results | type == "array"' >/dev/null 2>&1 <<< "$TAGS_RESPONSE"; then
        echo "Invalid response while fetching tags from Docker Hub." >&2
        exit 1
    fi

    while IFS= read -r TAG; do
        if [[ "$TAG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] && \
            { [ -z "$HIGHEST_TAG" ] || version_is_greater "$TAG" "$HIGHEST_TAG"; }; then
            HIGHEST_TAG="$TAG"
        fi
    done < <(jq -r '.results[]?.name // empty' <<< "$TAGS_RESPONSE")

    TAGS_URL="$(jq -r '.next // empty' <<< "$TAGS_RESPONSE")"
done

if [ -z "$HIGHEST_TAG" ]; then
    echo "No published CapRover versions were found on Docker Hub." >&2
    exit 1
fi

if ! version_is_greater "$CAPROVER_VERSION" "$HIGHEST_TAG"; then
    echo "The version you are pushing is not valid: $CAPROVER_VERSION (latest published: $HIGHEST_TAG)" >&2
    exit 1
fi

printf '%s\n' "$CAPROVER_VERSION"
