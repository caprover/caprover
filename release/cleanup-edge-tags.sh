#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/release.conf"

KEEP_EDGE_COMMIT_TAGS="${KEEP_EDGE_COMMIT_TAGS:-100}"

if ! [[ "$KEEP_EDGE_COMMIT_TAGS" =~ ^[0-9]+$ ]] || [ "$KEEP_EDGE_COMMIT_TAGS" -lt 1 ]; then
    echo "KEEP_EDGE_COMMIT_TAGS must be a positive integer." >&2
    exit 1
fi

if [ -z "${REGISTRY_USERNAME:-}" ] || [ -z "${REGISTRY_PASSWORD:-}" ]; then
    echo "REGISTRY_USERNAME and REGISTRY_PASSWORD are required." >&2
    exit 1
fi

if ! command -v curl >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    echo "curl and jq are required." >&2
    exit 1
fi

if [[ "$EDGE_IMAGE_NAME" != */* ]]; then
    echo "EDGE_IMAGE_NAME must be in namespace/repository format." >&2
    exit 1
fi

NAMESPACE="${EDGE_IMAGE_NAME%%/*}"
REPOSITORY="${EDGE_IMAGE_NAME#*/}"
API_BASE="https://hub.docker.com/v2/namespaces/$NAMESPACE/repositories/$REPOSITORY"

AUTH_RESPONSE="$(
    jq -nc '{identifier: env.REGISTRY_USERNAME, secret: env.REGISTRY_PASSWORD}' |
        curl --fail-with-body --silent --show-error \
            --request POST \
            --header 'Content-Type: application/json' \
            --data-binary @- \
            'https://hub.docker.com/v2/auth/token'
)"
HUB_TOKEN="$(jq -r '.access_token // empty' <<<"$AUTH_RESPONSE")"

if [ -z "$HUB_TOKEN" ]; then
    echo "Docker Hub authentication did not return an access token." >&2
    exit 1
fi

TAG_FILE="$(mktemp)"
trap 'rm -f "$TAG_FILE"' EXIT

NEXT_URL="$API_BASE/tags?page_size=100&page=1"
while [ -n "$NEXT_URL" ]; do
    TAG_RESPONSE="$(
        curl --fail-with-body --silent --show-error \
            --header "Authorization: Bearer $HUB_TOKEN" \
            "$NEXT_URL"
    )"

    jq -c '
        .results[]
        | select((.name // "") | test("^[0-9a-f]{40}$"))
        | {name, last_updated}
    ' <<<"$TAG_RESPONSE" >>"$TAG_FILE"

    NEXT_URL="$(jq -r '.next // empty' <<<"$TAG_RESPONSE")"
done

COMMIT_TAG_COUNT="$(wc -l <"$TAG_FILE" | tr -d ' ')"
if [ "$COMMIT_TAG_COUNT" -le "$KEEP_EDGE_COMMIT_TAGS" ]; then
    echo "Found $COMMIT_TAG_COUNT edge commit tags; nothing to delete."
    exit 0
fi

TAGS_TO_DELETE="$(
    jq -s -r --argjson keep "$KEEP_EDGE_COMMIT_TAGS" '
        sort_by([.last_updated // "", .name])
        | reverse
        | .[$keep:][]
        | .name
    ' "$TAG_FILE"
)"

DELETE_COUNT=$((COMMIT_TAG_COUNT - KEEP_EDGE_COMMIT_TAGS))
echo "Keeping the newest $KEEP_EDGE_COMMIT_TAGS of $COMMIT_TAG_COUNT edge commit tags; deleting $DELETE_COUNT."

while IFS= read -r TAG; do
    [ -n "$TAG" ] || continue
    echo "Deleting old edge commit tag: $TAG"

    HTTP_STATUS="$(
        curl --silent --show-error \
            --output /dev/null \
            --write-out '%{http_code}' \
            --request DELETE \
            --header "Authorization: Bearer $HUB_TOKEN" \
            "$API_BASE/tags/$TAG"
    )"

    case "$HTTP_STATUS" in
        2??)
            ;;
        404)
            echo "Tag $TAG was already deleted."
            ;;
        *)
            echo "Docker Hub returned HTTP $HTTP_STATUS while deleting tag $TAG." >&2
            exit 1
            ;;
    esac
done <<<"$TAGS_TO_DELETE"
