#!/bin/bash

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/release.conf"

required_variables=(
    PR_TITLE
    PR_BASE_SHA
)

for variable_name in "${required_variables[@]}"; do
    if [ -z "${!variable_name:-}" ]; then
        echo "Missing required variable: $variable_name" >&2
        exit 1
    fi
done

if [[ "$PR_TITLE" =~ ^(Release|Hotfix)\ v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
    RELEASE_TYPE="${BASH_REMATCH[1]}"
    TITLE_VERSION="${BASH_REMATCH[2]}"
else
    echo "PR title must be 'Release vX.Y.Z' or 'Hotfix vX.Y.Z'." >&2
    exit 1
fi

if [ "$TITLE_VERSION" != "$CAPROVER_VERSION" ]; then
    echo "PR title version $TITLE_VERSION does not match release.conf version $CAPROVER_VERSION." >&2
    exit 1
fi

if ! git merge-base --is-ancestor "$PR_BASE_SHA" HEAD; then
    echo "The release PR does not contain the current release branch." >&2
    echo "Complete any pending release-to-master backmerge before preparing a normal release." >&2
    exit 1
fi

if [ "$RELEASE_TYPE" = "Hotfix" ]; then
    if git show-ref --verify --quiet refs/remotes/origin/master; then
        while read -r candidate_commit; do
            if git merge-base --is-ancestor "$candidate_commit" origin/master; then
                echo "Hotfix PRs cannot include unreleased commits from master." >&2
                exit 1
            fi
        done < <(git rev-list "$PR_BASE_SHA"..HEAD)
    else
        echo "origin/master is required to validate a hotfix PR." >&2
        exit 1
    fi
fi

echo "$RELEASE_TYPE v$CAPROVER_VERSION is a valid production release candidate."
