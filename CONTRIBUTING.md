# Contributing to CapRover

Before starting a change, discuss it with the maintainers through an issue, email, or the Slack channel linked from [CapRover.com](https://caprover.com/).

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## CapRover goals and scope

CapRover is a small control layer over Docker, nginx, and Let's Encrypt. It is intended to make common deployment workflows simple without becoming an enterprise orchestration platform like Kubernetes.

- Expose common use cases through simple UI controls. Use existing hooks and scripts for advanced or uncommon needs.
- Avoid duplicating every Docker or nginx configuration option in the UI. For example, deployment placement constraints can be configured directly in Docker; customizable nginx templates already cover advanced proxy configuration.
- Keep changes small and maintainable. Discuss large pull requests with maintainers beforehand so their scope can be agreed upon.

## Pull request process

1. If applicable, update the [documentation](https://github.com/caprover/caprover-website) for changes to the interface, environment variables, exposed ports, file locations, or container parameters.
2. Write self-explanatory commit messages.
3. Discuss proposed changes with maintainers beforehand.
4. Avoid opinion-based style refactors, including changes to promise handling, class inheritance, and other established conventions.
5. Development targets `master`; production publishes from `release`. Follow [RELEASING.md](RELEASING.md) for releases, hotfixes, and backmerges.
6. By opening a pull request, you agree to the [contributor agreement](contrib.md).
7. AI-generated code is welcome, provided it matches the style of neighboring code and stays appropriately simple. Avoid unnecessary complexity for rare edge cases.

## Backend development environment

Use Node.js 24 and Docker. The development scripts run CapRover in debug mode, either on a dedicated local machine or a development VM.

**Warning:** The clean-run scripts remove existing Docker Swarm services and the `captain-salt` secret, and clear the `/captain` directory. Run them only on a dedicated development environment where that data can be discarded.

### Linux

From the repository root:

```bash
npm ci
npm run build
sudo ./dev-scripts/dev-clean-run-as-dev.sh
```

To rebuild and restart the backend after making changes:

```bash
npm run dev
```

### macOS

On macOS Catalina and later, use `/etc/synthetic.conf` to make a writable directory accessible at `/captain`:

1. Create a directory such as `/opt/captain`.
2. Add a line to `/etc/synthetic.conf` mapping `captain` to `opt/captain`, separated by a tab.
3. Reboot, then add `/captain` to Docker Desktop's file-sharing settings.

With Node.js 24 installed, run from the repository root:

```bash
npm ci
npm run build
sudo ./dev-scripts/dev-clean-run-as-dev-macos-step-1.sh
./dev-scripts/dev-clean-run-as-dev-macos-step-2.sh
```

### Debug-mode behavior

Compared with the production build:

- The Docker image is built from local source.
- Debug mode uses a static salt and weaker security settings.
- Self-health monitoring is disabled so crashes remain visible.
- Same-origin restrictions are relaxed for frontend development.
- The `/force-exit` endpoint restarts the backend service.
- Static resources, including the frontend app, are not served.

CapRover uses `captain.localhost` as the default root domain in development. If you need wildcard subdomains, configure your local DNS to resolve `*.captain.localhost` to your development host's IP address. A hosts-file entry cannot provide wildcard DNS.

To test the API, import `dev-scripts/CapRover_Postman_Collection.json` into Postman.

## Other development

- **Frontend:** [caprover/caprover-frontend](https://github.com/caprover/caprover-frontend)
- **CLI:** [caprover/caprover-cli](https://github.com/caprover/caprover-cli)

For backend changes, save your files and restart the debug service with `npm run dev` or the `/force-exit` endpoint.

## Security issues

Follow the reporting instructions in [SECURITY.md](SECURITY.md).
