# CapRover safe Ubuntu installer

Target: **fresh Ubuntu 24.04 VPS, amd64 or arm64, 1 GiB RAM minimum, Docker Engine 25+, single-node Docker Swarm**.

Source requirements: [CapRover Getting Started](https://caprover.com/docs-next/get-started), [CapRover Firewall](https://caprover.com/docs-next/domains/firewall), and [official Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/).

## Run

Copy `caprover-install.sh` to the server first.

```bash
# 1. Inspect everything first (read-only):
sudo bash caprover-install.sh --check

# 2. Install interactively (accept CapRover terms when prompted):
sudo bash caprover-install.sh

# Or unattended with an explicit terms acceptance:
sudo bash caprover-install.sh --yes --accept-terms

# Optional wildcard DNS preflight:
sudo bash caprover-install.sh --check --domain apps.example.com
```

## Interactive confirmation defaults

- **Accept CapRover terms? `[y/N]`**: No by default. You must type `y`/`yes` (or explicitly pass `--accept-terms`), because accepting terms requires affirmative consent.
- **Proceed with installation? `[Y/n]`**: Yes by default after a successful preflight. Press **Enter**, `y`, or `yes` to proceed; `n`, `no`, an unrecognized answer, or end-of-input cancels without installation changes. `--yes` skips this prompt.
- **Risky conditions**, such as untested Ubuntu versions or reusing a Swarm, still require explicit override flags. Existing workloads, unsafe port conflicts and existing CapRover data remain blocking conditions.

**Terminal output:** `[FAIL]` messages appear red on an interactive terminal, including option/usage errors. Color is disabled for redirected output, `TERM=dumb` or `NO_COLOR=1`. Non-color output retains the standard `[FAIL]` prefix for parsing and logs.

The script leaves **provider firewall** changes, initial **DNS setup**, **domain configuration**, **password change**, and **HTTPS activation** for the operator. After successful setup, restrict/close `3000/tcp`. The public IPv4 service `ipconfig.io` identifies the *egress IP*, not whether ports are remotely reachable. After installation, the script asks `check-host.net` nodes to connect to public TCP ports 80, 443 and 3000 by default. Use `--skip-external-check` to opt out. Third-party test failures produce warnings, not installation errors.

## Behavior

| Area | Behavior |
|---|---|
| OS, architecture, memory, CPU, disk, inode and cgroups | Validate, with hard errors for unsupported or undersized hosts |
| IPv4, route, public address and optional wildcard DNS | Inspect, warn on NAT/IP mismatch, bad DNS and unverified network edges |
| Docker absent | Install Docker CE from Docker's official signed Ubuntu apt repository |
| Docker present but stopped | Attempt to start the existing systemd Docker service |
| Old Docker, rootless Docker, Docker snap, remote Docker context | Block; avoid replacing/migrating existing installations |
| Existing Docker containers | Preserve and warn; block published-port conflicts (even with Docker userland proxy disabled) |
| Existing Docker Swarm | Block by default; allow an empty single-node manager only with `--use-existing-swarm` |
| Existing CapRover config or services | Block to avoid overwriting installation data |
| Host port conflicts | Check 80/tcp, 443/tcp, 3000/tcp, 2377/tcp, 7946/tcp+udp and 4789/udp; warn for optional 443/udp |
| UFW active | Allow public 80/443/3000 TCP if no existing source-restricted rule; preserve existing rules |
| UFW inactive | Leave inactive, warn; avoid SSH lockouts from automatic firewall enablement |
| iptables/nftables/firewalld | Inspect known blocking configurations and warn for manual review |
| Docker daemon networking | Check IPv4 forwarding and relevant daemon.json flags |
| Install and readiness | Pull CapRover, run bootstrap, verify Swarm service is running and dashboard responds locally |
| External verification | Query independent TCP test nodes via check-host.net by default; opt out with `--skip-external-check` |

## Security boundaries

- **Never** uninstall other Docker packages automatically, delete existing containers, abandon an existing Swarm, overwrite `/captain`, open Docker's registry port 996 publicly, or add publicly reachable Swarm VXLAN ports.
- The guest cannot inspect a hosting-provider firewall or prove all UDP traffic is routable. Docker-published ports can bypass UFW's INPUT rules. Apply fine-grained ingress restrictions in the provider's firewall or Docker-aware firewall rules.
- The first sign-in password is `captain42`. Change it promptly. Configure a wildcard A record and enable HTTPS.
- Test on a disposable Ubuntu 24.04 VPS before distributing as a production installer. The script has syntax and mocked-behavior tests, but the full Docker/CapRover bootstrap was not executed against a live Ubuntu VPS in this session.

## Tests

```bash
bash -n caprover-install.sh
bash test-caprover-install.sh
```

The tests exercise the option parser, Docker-missing path, host socket port conflict, Docker port bindings, existing Swarm rejection, UFW source restriction preservation, and the remote TCP response parser.
