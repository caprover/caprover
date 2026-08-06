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

## Change constraints

- Preserve API v2 response shapes, status handling, and compatibility with existing installations.
- Return only data required by the caller; never expose raw Docker objects merely because fields are available.
- Treat service names, volume names, labels, secrets, certificates, and data under `/captain/data` as persistent compatibility contracts. Account for legacy resources explicitly.
- Before deleting or mutating Docker resources, prove that CapRover owns the exact resource and that it is not shared. Prefer a safe no-op or diagnostic logging when ownership is uncertain.
- Never allow request payloads to overwrite server-derived or immutable fields.
- Keep routes thin. Use the existing managers, `InjectionExtractor`, `ApiStatusCodes`, `BaseApi`, and `Logger` patterns instead of parallel mechanisms.
- Add focused regression tests for behavior changes and failure paths. Avoid unrelated refactors or style-only changes.

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
