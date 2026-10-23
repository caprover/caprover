## Product boundary

CapRover is a deliberately small control layer over Docker Swarm, nginx, and Let's Encrypt. Optimize common deployment workflows; do not mirror every capability of the underlying tools. Prefer existing customization hooks for advanced or uncommon cases.

Keep changes narrowly scoped. Do not add API fields, configuration, or abstractions without a concrete use case. Discuss large or cross-cutting features before implementing them.

## Repository map

- `src/app.ts`: Express bootstrap and API mounting.
- `src/routes/`: HTTP validation and response orchestration.
- `src/handlers/`: request-level application operations.
- `src/user/`: core managers and service orchestration.
- `src/docker/`: Docker API integration.
- `src/datastore/`: persisted CapRover state.
- `src/injection/`: request-scoped dependencies and authentication.
- `src/models/`: shared data contracts.
- `src/utils/CaptainConstants.ts`: runtime configuration, identifiers, and filesystem paths.
- `tests/`: Jest regression tests.

The frontend is maintained in `caprover/caprover-frontend`. User-facing documentation is maintained in `caprover/caprover-website`.

For releases, hotfixes, and backmerges, follow [RELEASING.md](RELEASING.md).

## Code design and consistency

- **Inspect neighboring code first:** read the closest routes, managers, models, helpers, callers,
  and tests. Independently outline the simplest complete implementation using existing patterns.
- Match local conventions for naming, file structure, promises, error handling, and dependency
  ownership. If a similar feature already exists, follow its pattern unless a change is justified.
- Favor **KISS, YAGNI, and proportionate DRY**. Add abstractions only for concrete reuse or a
  clear reduction in complexity. Avoid one-off wrappers, generic frameworks, and redundant state.
- Keep responsibilities in their established layers. Avoid routing routine work through unrelated
  managers or adding coordination and indirection where a direct call is sufficient.
- Prefer concise control flow. Consolidate identical branches and state transitions; avoid copied
  conditionals, unnecessary special cases, and scattered hardcoded status strings.
- Maintain a single source of truth for API models, validation rules, supported Compose fields,
  and capability lists. Trace contract changes across the backend, `caprover-api`, frontend,
  and one-click templates; update every affected consumer and relevant test.
- Use existing TypeScript models and explicit types at API and domain boundaries. Avoid `any`,
  unsafe casts, speculative generics, and ambiguous untyped return contracts.
- Handle asynchronous failures, concurrent operations, retries, and legacy inputs deliberately.
  Avoid arbitrary sleeps as synchronization; verify actual Docker/control-plane outcomes.

## Change constraints

- Preserve API v2 response shapes, status handling, and compatibility with existing installations.
- Return only data required by the caller; never expose raw Docker objects merely because fields are available.
- Treat service names, volume names, labels, secrets, certificates, and data under `/captain/data` as persistent compatibility contracts. Account for legacy resources explicitly.
- Before deleting or mutating Docker resources, prove that CapRover owns the exact resource and that it is not shared. Prefer a safe no-op or diagnostic logging when ownership is uncertain.
- Never allow request payloads to overwrite server-derived or immutable fields.
- Keep routes thin. Use the existing managers, `InjectionExtractor`, `ApiStatusCodes`, `BaseApi`, and `Logger` patterns instead of parallel mechanisms.
- Add focused regression tests for behavior changes and failure paths. Avoid unrelated refactors or style-only changes.

## Review checklist

1. Identify the simplest implementation consistent with nearby code **before** accepting the
   PR's chosen architecture. Compare the submitted design against that baseline.
2. Question each new abstraction, helper, repeated condition, state owner, and cross-layer
   dependency. Explain when an existing method or pattern would be simpler.
3. Trace correctness end to end: request validation, typed response, persistence, Docker
   behavior, compatibility, errors, races, and regression tests. Validate assumptions in code.
4. Report actionable findings with file/line, concrete impact, and the smallest viable fix.
   Separate merge blockers from optional improvements; avoid opinion-only refactoring.
5. Report tests and runtime checks actually performed. Mocked tests alone do not establish
   correctness of host filesystem, Docker, or multi-node behavior.

## Validation

Use Node.js 24.

```bash
npm ci
npm run formatter
npm run lint
npm run build
npm test -- --runInBand
```

Run the narrowest relevant Jest test while iterating, then the full suite before handoff. `npm run build` includes TypeScript compilation and circular-dependency detection.
