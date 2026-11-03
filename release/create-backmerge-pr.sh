#!/bin/bash

set -e
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/release.conf"

if [ -z "${GH_TOKEN:-}" ] || [ -z "${GITHUB_REPOSITORY:-}" ] || [ -z "${GITHUB_SHA:-}" ]; then
    echo "GH_TOKEN, GITHUB_REPOSITORY, and GITHUB_SHA are required." >&2
    exit 1
fi

BACKMERGE_BRANCH="backmerge-v$CAPROVER_VERSION"
BACKMERGE_BRANCH_SHA="$(
    gh api "/repos/$GITHUB_REPOSITORY/git/ref/heads/$BACKMERGE_BRANCH" \
        --jq '.object.sha' 2>/dev/null || true
)"

if [ -n "$BACKMERGE_BRANCH_SHA" ]; then
    if [ "$BACKMERGE_BRANCH_SHA" != "$GITHUB_SHA" ]; then
        echo "$BACKMERGE_BRANCH already points to $BACKMERGE_BRANCH_SHA, expected $GITHUB_SHA." >&2
        exit 1
    fi
else
    gh api "/repos/$GITHUB_REPOSITORY/git/refs" \
        --method POST \
        --field "ref=refs/heads/$BACKMERGE_BRANCH" \
        --field "sha=$GITHUB_SHA" \
        --silent
    echo "Created $BACKMERGE_BRANCH at $GITHUB_SHA."
fi

EXISTING_PR_URL="$(
    gh pr list \
        --repo "$GITHUB_REPOSITORY" \
        --base master \
        --head "$BACKMERGE_BRANCH" \
        --state open \
        --json url,isCrossRepository \
        --jq 'map(select(.isCrossRepository == false)) | .[0].url // empty'
)"

if [ -n "$EXISTING_PR_URL" ]; then
    echo "Backmerge PR already exists: $EXISTING_PR_URL"
    PR_URL="$EXISTING_PR_URL"
else
    PR_URL="$(
        gh pr create \
            --repo "$GITHUB_REPOSITORY" \
            --base master \
            --head "$BACKMERGE_BRANCH" \
            --title "Backmerge v$CAPROVER_VERSION from release into master" \
            --body "Automated backmerge after successfully publishing v$CAPROVER_VERSION."
    )"

    echo "Created backmerge PR: $PR_URL"
fi

for workflow in build_project.yml format_project.yml lint_project.yml; do
    gh workflow run "$workflow" \
        --repo "$GITHUB_REPOSITORY" \
        --ref "$BACKMERGE_BRANCH"
done

if gh pr merge --repo "$GITHUB_REPOSITORY" --auto --merge "$PR_URL"; then
    echo "Enabled auto-merge for $PR_URL"
else
    echo "::warning::Auto-merge is unavailable or the PR requires manual conflict resolution."
fi
