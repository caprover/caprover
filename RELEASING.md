# Releasing CapRover

## Branches and automation

`master` holds unreleased development; `release` holds production. Both feature
releases and hotfixes ship through a PR into `release`. Use **merge commits** for
release and backmerge PRs: later validation requires the current `release` tip
to be an ancestor of the candidate.

| Trigger | Automated result |
| --- | --- |
| PR into `master` or `release` | Build/tests, lint/tests, formatter (Node.js 24). |
| PR into `release` | Also validates exact title/version, release ancestry, hotfix isolation, changelog heading, and unused Git/Docker tags. |
| Push to `master` | Repeats checks, builds frontend, publishes `caprover/caprover-edge:<full commit SHA>`, `:latest`, and `:0.0.1` for amd64/arm64. Keeps newest 100 SHA tags by default. |
| Push to `release` | Repeats checks, builds pinned frontend, publishes `caprover/caprover:X.Y.Z` and `:latest` for amd64/arm64; prepares draft GitHub release `vX.Y.Z`; opens pinned backmerge PR into `master`. |

Publication runs queue per channel. Docker publication precedes the GitHub
draft and backmerge; a draft is **not** a production approval gate.
Tag pushes and publishing a GitHub release do not trigger image builds.

**Tooling transition:** as of 2026-10-18, `release` is at v1.15.4 and lacks
`release/release.conf`; the automation above is on `master` (introduced in
[#2476](https://github.com/caprover/caprover/pull/2476) and related PRs). The next
normal release brings it across. Before any hotfix, inspect its base: with
legacy tooling, bump `configs.version` in `src/utils/CaptainConstants.ts`,
update `FRONTEND_COMMIT_HASH` in `dev-scripts/build_and_push_release.sh` only if
needed, and add the changelog entry. That workflow publishes Docker only;
manually prepare/publish the GitHub release/tag at the published commit and
merge `release` back into `master`. Verify applicable PR checks against that
legacy tree; the new validation scripts are absent. Keep any tooling backport
explicit and scoped.

## Prepare a release (manual)

1. Fetch branches/tags and finish pending production publication/backmerges.
   Choose an unused, increasing `X.Y.Z`. Feature releases have historically
   been `1.N.0`; hotfixes `1.N.P`. A SemVer major uses the same release path;
   compatibility/migration requirements belong in its notes.
2. Choose the base:

   | Release type | Candidate branch base | Required PR title | PR base |
   | --- | --- | --- | --- |
   | Feature / major | Selected `origin/master` commit, after backmerges | `Release vX.Y.Z` | `release` |
   | Hotfix | Current `origin/release` tip | `Hotfix vX.Y.Z` | `release` |

   Short-lived names such as `release-candidate/X.Y.Z` or `hotfix/X.Y.Z` are
   conventions. A candidate freezes backend scope at its selected commit.
   Apply only the hotfix; cherry-pick a fix already on `master` instead of
   merging `master`. Validation rejects commits above the release base that
   are already ancestors of `origin/master`.
3. Set `CAPROVER_VERSION` in [release/release.conf](release/release.conf).
   Set `RELEASE_FRONTEND_COMMIT` to the full tested SHA in the configured
   `FRONTEND_REPOSITORY`; retain the production pin for backend-only hotfixes.
   `EDGE_FRONTEND_COMMIT` is independent: empty means frontend repository HEAD,
   so a backend SHA alone does not reproduce the edge frontend. `package.json`
   stays `0.0.0`; runtime version comes from `release.conf`.
4. Add `## [X.Y.Z] - YYYY-MM-DD` to [CHANGELOG.md](CHANGELOG.md). For a feature
   release, move included `Next Version` entries into it and retain an
   unreleased section. For a hotfix, list only what ships and preserve pending
   notes. Check notes against the backend diff and frontend pin; draft release
   notes are copied verbatim from this section.
5. Test the candidate and selected frontend together, including installation,
   upgrade from production, and affected workflows. CI runs backend checks and
   frontend compilation; live installation/upgrade testing is manual. Run the
   backend checks in [AGENTS.md](AGENTS.md), then open the PR with the exact
   title above. Require `build`, `check-code-formatting`, `run-lint`, and
   `validate-release-pr` to pass. If `release` advances, update the candidate
   and recheck scope/ancestry before merging.
6. Merge into `release` with a merge commit, starting production publication.
   Leave `vX.Y.Z` uncreated until the draft/publication step: validation rejects
   an existing Git tag or Docker version tag. Even metadata-only pushes to
   `release` trigger publication.

## Finish the release (manual verification)

1. Follow [publish_release.yml](.github/workflows/publish_release.yml) through
   all jobs. Verify both image architectures and the published manifest digest;
   record the run's `GITHUB_SHA` as the published backend commit.
2. Review the generated draft's notes and target commit, then **publish the
   GitHub release**. Verify `vX.Y.Z` resolves to the published backend commit.
3. Finish the `backmerge-vX.Y.Z` PR into `master`. Automation pins its branch
   to the published commit, explicitly dispatches build/format/lint (PRs opened
   with `GITHUB_TOKEN` do not trigger those workflows), and attempts
   `--auto --merge`. Check actual merge status: auto-merge can be unavailable
   and its failure is only a warning. Use a merge commit, preserving pending
   changelog entries and development settings. For conflicts, branch from
   `master`, merge the published commit into it, resolve, and PR into `master`;
   close the superseded backmerge after that merges. Keep automation's pinned
   branch unchanged for recovery. After fetching, verify
   `git merge-base --is-ancestor <published-SHA> origin/master`.
4. Coordinate upgrade-banner rollout separately. Official installations read
   `https://api-v1.caprover.com/v2/versionInfo` via
   [VersionManager.ts](src/user/system/VersionManager.ts). This repo contains
   no rollout update automation. Confirm the API's intended version,
   eligibility, and notes with its operator; v1.15.0 used gradual banner
   rollout. Docker/GitHub publication alone does not confirm banner availability.

Repository settings must support the intended gates: release PR checks above,
backmerge build/format/lint checks, and Actions permission to create PRs.
At 2026-10-18, the release ruleset requires a PR but specifies no required
checks/approvals, and repository auto-merge is disabled. Verify checks and
complete merges explicitly; recheck settings before relying on enforcement.

## Partial failure

- If Docker publication succeeded and a later job failed, use **Re-run failed
  jobs** on that run. A whole-workflow retry fails version availability checks
  once the Docker tag exists.
- If the publishing job failed after pushing the version tag, first match its
  manifest digest to the run's `buildx` output. Check out that exact published
  SHA. With `GH_TOKEN` providing repository write/PR/Actions access, set
  `GITHUB_REPOSITORY=caprover/caprover` and `GITHUB_SHA` to that SHA, then run
  `./release/create-draft-release.sh` followed by
  `./release/create-backmerge-pr.sh`. Inspect existing drafts/PRs before retrying;
  scripts validate tag/branch targets but do not refresh existing notes.
- If the artifact cannot be verified, investigate before proceeding. Fix
  shipped defects in a new version; preserve published version tags.

Implementation: [release scripts](release/) and [workflows](.github/workflows/).
