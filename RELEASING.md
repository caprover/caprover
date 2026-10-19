# Release process

The `release` branch is the only production publishing branch. Normal releases
and hotfixes both enter production through a pull request targeting `release`.
Pushes to `master` publish the edge image.

## Normal release

1. Complete any pending `release` to `master` backmerge.
2. Create a short-lived branch from the desired commit on `master`, for example
   `release-candidate/X.Y.Z`. Later commits to `master` wait for the next release.
3. Set `CAPROVER_VERSION` and pin `RELEASE_FRONTEND_COMMIT` to a tested frontend
   SHA in `release/release.conf`. This file also selects the frontend repository;
   `package.json` stays `0.0.0`.
4. Move the included `Next Version` notes into a
   `## [X.Y.Z] - YYYY-MM-DD` section in `CHANGELOG.md`. Retain an unreleased
   section and check the notes against the backend diff and frontend pin.
5. Open `Release vX.Y.Z` targeting `release`. The title must match exactly.
6. Test installation, upgrade, and affected behavior with the selected frontend.
   Once PR checks pass, merge with a **merge commit** to start publication.

Feature releases have historically used `1.N.0`; hotfixes use `1.N.P`.
A SemVer major follows the normal release path, with migration requirements in
its notes. Choose an increasing, unused version. Leave its Git tag uncreated:
release validation rejects existing `vX.Y.Z` and Docker `X.Y.Z` tags.

## Hotfix

1. Create a short-lived branch from the current `release` tip. Check the
   [tooling transition](#tooling-transition) below first.
2. Apply only the fix. Cherry-pick fixes already on `master`; merging `master`
   would bring in unreleased work and fail hotfix validation.
3. Update `CAPROVER_VERSION` and add a dated changelog section containing only
   the hotfix. Keep the production frontend pin unless the fix needs a new one.
4. Open `Hotfix vX.Y.Z` targeting `release`. Test the fix and upgrade, then merge
   with a **merge commit** after checks pass.

The automated backmerge carries the fix and release metadata into `master`.
Use merge commits for release and backmerge PRs: future release candidates must
contain the current `release` tip in their ancestry. If `release` advances while
preparing a candidate, update the candidate and recheck its scope.

## What happens automatically

- PRs into `master` and `release` run build/tests, lint/tests, and formatting.
  Release PRs also check title/version, changelog, ancestry, hotfix isolation,
  and Git/Docker version availability.
- Each push to `release` repeats checks, builds the pinned frontend, and pushes
  `caprover/caprover:X.Y.Z` and `:latest` for amd64/arm64. Production runs queue
  sequentially. Every push triggers this, including documentation-only pushes.
- After Docker publication, automation prepares a draft GitHub release
  `vX.Y.Z`, targeting the published commit, with notes from its changelog section.
  It then opens `backmerge-vX.Y.Z` into `master`, pinned to that same commit.
- The backmerge script dispatches build/format/lint explicitly because PRs
  opened with `GITHUB_TOKEN` do not trigger PR workflows. It attempts auto-merge;
  failure to enable it produces only a warning.
- Pushes to `master` publish `caprover/caprover-edge:<full commit SHA>`, `:latest`,
  and `:0.0.1`. An empty `EDGE_FRONTEND_COMMIT` builds frontend HEAD independently
  of the backend SHA. Git tags and GitHub release publication do not build images.

## Finish manually

1. Verify all publishing jobs succeeded and both image architectures/tags match
   the run's manifest digest. Record its `GITHUB_SHA` as the published commit.
2. Review and **publish the draft GitHub release**. Verify `vX.Y.Z` resolves to
   the published commit. Docker publication has already happened at this point.
3. Ensure the backmerge actually merged into `master`. Preserve pending
   changelog notes and development settings. For conflicts, create a separate
   branch from `master`, merge the published commit into it, resolve, and open
   a replacement PR. Keep the generated branch pinned for recovery. After
   merging and fetching, verify
   `git merge-base --is-ancestor <published-SHA> origin/master`.
4. Coordinate upgrade-banner rollout with the operator of
   `https://api-v1.caprover.com/v2/versionInfo`. This repository has no automation
   for that service; v1.15.0 used a gradual banner rollout.

## Recovering a partial release

If Docker publication succeeded and a later job failed, use **Re-run failed
jobs** on the existing run. A whole-workflow retry fails version availability
checks once the Docker tag exists.

If the publishing job failed after pushing, confirm the manifest digest against
its `buildx` output and check out the exact published commit. With `GH_TOKEN`
providing repository write, PR, and Actions access, run:

```bash
export GITHUB_REPOSITORY=caprover/caprover
export GITHUB_SHA="$(git rev-parse HEAD)"
./release/create-draft-release.sh
./release/create-backmerge-pr.sh
```

Inspect existing drafts/PRs before retrying; scripts validate tag/branch targets
but leave existing release notes unchanged. Investigate unverifiable artifacts.
Fix shipped defects in a new version and preserve published version tags.

## Repository settings

Require release PR checks `build`, `check-code-formatting`, `run-lint`, and
`validate-release-pr`; require build/format/lint for backmerges. Actions needs
permission to create PRs. As of 2026-10-18, the release ruleset requires a PR
without required checks/approvals, and auto-merge is disabled. Verify checks and
finish merges explicitly until settings enforce these gates.

## Tooling transition

As of 2026-10-18, `release` is at v1.15.4 with the legacy tooling; the next normal
release brings the new automation from `master`. Before a hotfix, inspect its
base. If `release/release.conf` is absent, bump `configs.version` in
`src/utils/CaptainConstants.ts` and update `FRONTEND_COMMIT_HASH` in
`dev-scripts/build_and_push_release.sh` if needed. Add the changelog entry and
verify applicable PR checks; the new validation scripts are absent. That
workflow publishes Docker only. Manually create/publish the GitHub release/tag
at the published commit and backmerge `release` into `master`. Keep any tooling
backport explicit and scoped.

Implementation: [release scripts](release/) and [workflows](.github/workflows/).
