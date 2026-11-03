#!/usr/bin/env bash
# =============================================================================
# CAPROVER INSTALLER: PLAIN-ENGLISH EXECUTION FLOW
# =============================================================================
#
# PURPOSE
#   Safely prepare a fresh Ubuntu server and install a SINGLE-NODE CapRover.
#   Report [ OK ], [INFO], [WARN] and [FAIL] messages so the operator knows
#   exactly what was checked, changed, or left for manual review.
#   Errors appear red and warnings yellow on color-capable interactive terminals;
#   redirected logs and NO_COLOR remain free from ANSI escape sequences.
#
# FLOWCHART / DECISION TREE
#
#   START
#     |
#     v
#   [1. Read command-line options]
#     |  --check              = audit only; make NO server changes
#     |  --yes                = skip the final interactive confirmation
#     |  --accept-terms       = explicitly accept CapRover's terms
#     |  external TCP checks = ON after install (default; uses check-host.net)
#     |  --skip-external-check = disable post-install external TCP checks
#     |  --domain NAME        = also inspect wildcard DNS for that domain
#     |  --image IMAGE        = use an alternative CapRover Docker image
#     |  --use-existing-swarm = allow safe reuse of an EMPTY one-node Swarm
#     |  --allow-other-ubuntu = allow another Ubuntu version with a warning
#     |  --help               = print usage and exit
#     |  Invalid/missing options, invalid image or domain? -> STOP.
#     |  Unattended install with --yes but no --accept-terms? -> STOP.
#     v
#   [2. Check the server itself]
#     |  Require root, Ubuntu (24.04 is tested), amd64 or arm64.
#     |  Reject WSL or an already-containerized environment.
#     |  Require >=1 GiB RAM and >=5 GiB free on Docker's filesystem;
#     |  warn below 2 GiB RAM or 10 GiB disk. Inspect CPU and free inodes.
#     |  Check /captain is absent/empty: existing data -> STOP.
#     |  Check cgroups, systemd availability, clock synchronization, swap,
#     |  IPv4 forwarding, and availability of the VXLAN kernel module.
#     |  Hard problems become [FAIL]; less certain risks become [WARN].
#     v
#   [3. Inspect networking, without modifying it]
#     |  Require the ip and ss commands and an IPv4 address/default route.
#     |  Show local IPv4 address(es) and outbound interface address.
#     |  Ask ipconfig.io (fallback: api.ipify.org) for PUBLIC EGRESS IPv4.
#     |  Warn if egress IP differs from local IP (NAT/floating IP possible).
#     |  If --domain was provided, resolve a random *.DOMAIN hostname;
#     |  report absent or apparently mismatched wildcard DNS.
#     |  NOTE: an IP-echo service cannot tell whether an inbound port is open.
#     v
#   [4. Inspect Docker and existing workloads]
#     |
#     +-- Docker command missing?
#     |     |  Plan to install official Docker CE later, in install mode.
#     |     |  Check for Docker Snap, conflicting runtime packages, or
#     |     |  nonempty /var/lib/docker data; unsafe cases -> [FAIL].
#     |     +-- Otherwise, continue with Docker marked "missing".
#     |
#     +-- Docker command exists?
#           |  Require the local default context/socket; reject remote
#           |  DOCKER_HOST/DOCKER_CONTEXT and Docker Snap.
#           |
#           +-- Daemon unavailable?
#           |     |  --check: [FAIL], because workloads cannot be inspected.
#           |     +-- install: warn; plan to start docker.service later.
#           |
#           +-- Daemon available?
#                 |  Require Docker Engine server version >=25, rootful
#                 |  mode, its UNIX socket, and suitable IP forwarding.
#                 |  Inspect daemon.json for disabled iptables/forwarding.
#                 |  Examine Swarm state:
#                 |    - Inactive: allow CapRover to initialize Swarm.
#                 |    - Active worker: [FAIL].
#                 |    - Active manager: [FAIL] by default.
#                 |    - With --use-existing-swarm: allow only EXACTLY
#                 |      one node and ZERO existing services.
#                 |  List all containers; warn and preserve unrelated ones.
#                 |  Existing CapRover container/service names -> [FAIL].
#                 |  Existing Docker-published TCP 80/443/3000 -> [FAIL],
#                 |  even if no process appears as listening in ss.
#     v
#   [5. Check host listening ports]
#     |  TCP 80, 443, 3000: listener -> [FAIL] (CapRover needs these).
#     |  UDP 443: listener -> [WARN] (optional HTTP/3 conflict).
#     |  If Swarm is INACTIVE, also require unoccupied:
#     |    TCP 2377, TCP/UDP 7946, UDP 4789.
#     |  If Swarm is ACTIVE, these are considered owned by Swarm.
#     v
#   [6. Inspect host firewall (still read-only)]
#     |  UFW active? Plan TCP 80/443/3000 rules for installation.
#     |    Existing explicit DENY/REJECT for these -> [FAIL].
#     |  UFW inactive/absent/unreadable? Warn; leave state unchanged.
#     |  Inspect iptables, nftables, and firewalld where present;
#     |  warn about potentially blocking policies or rules.
#     |  Warn about possible IPv6 exposure and Docker's UFW bypass.
#     |  Provider firewalls/security groups cannot be edited here.
#     v
#   [7. Decision gate: any [FAIL] from steps 2-6?]
#     |  YES -> print error/warning counts; STOP before installation.
#     |  NO  -> continue.
#     |
#     +-- --check specified?
#     |     |  Print audit summary, make ZERO changes, and EXIT.
#     |     +-- External TCP checks are skipped in audit-only mode.
#     |
#     +-- Installation mode?
#           |  If terms were not accepted with --accept-terms, ask
#           |  interactively; explicit Yes required ([y/N], default No).
#           |  Unless --yes, ask to proceed ([Y/n], default Yes).
#           |  A No response to either prompt -> EXIT without changes.
#           |  EOF or invalid responses -> CANCEL (no changes).
#           v
#   [8. Recover or install Docker, if needed]
#     |
#     +-- Docker missing? -> apt update; install CA certs/curl; add
#     |   Docker's signed Ubuntu apt repository; install Docker Engine,
#     |   CLI, containerd, Buildx, Compose; enable/start docker.service.
#     |   Check daemon responsiveness; re-audit Docker/Swarm/containers.
#     |
#     +-- Docker installed but daemon down? -> start existing docker.service;
#     |   then re-audit Docker/Swarm/containers. Never replace its packages.
#     |
#     +-- Docker already healthy? -> leave its installation unchanged.
#     |  Any failure or newly detected conflict -> STOP.
#     v
#   [9. Recheck port listeners AFTER Docker starts/installs]
#     |  Docker startup may have created listeners. Any required conflict
#     |  -> STOP. The earlier Docker workload audit also detects NAT-based
#     |  published ports that ss alone may miss.
#     v
#   [10. Make narrowly scoped firewall changes]
#     |  If UFW is active, ensure TCP 80, 443, and 3000 have allow rules.
#     |  Preserve existing source-restricted allow rules, including 3000.
#     |  Never enable UFW if inactive; never rewrite SSH policy.
#     |  Never edit raw iptables/nftables/firewalld or cloud firewalls.
#     |  Never automatically open Swarm peer or registry ports publicly.
#     |  Failure to add required UFW rules -> STOP.
#     v
#   [11. Prepare safe existing-Swarm reuse, only when opted in]
#     |  If reusing the already-verified empty one-node manager Swarm,
#     |  create /captain/data/config-override.json with
#     |  {"useExistingSwarm": true}; refuse to overwrite an existing file.
#     |  Otherwise CapRover is responsible for initializing new Swarm.
#     v
#   [12. Bootstrap CapRover]
#     |  Create /captain (if absent); docker pull the selected image;
#     |  docker run a container named caprover-bootstrap with:
#     |    - host TCP ports 80:80, 443:443, 3000:3000
#     |    - ACCEPTED_TERMS=true
#     |    - /var/run/docker.sock and /captain mounted
#     |  CapRover's bootstrap creates/configures its Swarm services.
#     |  Pull or container start failure -> [FAIL] and STOP.
#     v
#   [13. Verify installation]
#     |  Poll captain-captain Swarm service (up to ~3 minutes) until its
#     |  task reports Running twice; catch failed bootstrap exits/logs.
#     |  Then poll http://127.0.0.1:3000 (up to ~1 minute) for a valid
#     |  2xx/3xx/401/403 HTTP response. Failure -> [FAIL] and STOP.
#     v
#   [14. Public TCP reachability test (runs by default)]
#     |  Skip only if --skip-external-check was supplied.
#     |  Reuse or rediscover the observed PUBLIC EGRESS IP.
#     |  Query check-host.net nodes for inbound TCP 80, 443, and 3000.
#     |  Report reachable / blocked / inconclusive as info or warnings.
#     |  This cannot validate UDP, HTTPS certificates, DNS, NAT mappings,
#     |  every outside network, or the hosting provider's firewall rules.
#     v
#   [15. Finish]
#     |  Print installation summary and dashboard URL (public IP:3000).
#     |  Show initial password 'captain42' and urgent change reminder.
#     |  Remind operator to configure wildcard DNS, CapRover root domain,
#     |  HTTPS, and then restrict/close public access to port 3000.
#     |  Print Docker diagnostic commands and final warning/error counts.
#     v
#   END
#
# SAFETY / SCOPE
#   - Audit-only mode makes no intentional host configuration changes.
#   - Existing Docker workloads, other containers, Swarm services and
#     /captain data are never removed, migrated, or overwritten.
#   - [WARN] flags a concern that may need operator attention; [FAIL]
#     blocks installation at the applicable decision gate.
#   - Provider firewall changes, inbound NAT/port forwarding, DNS records,
#     admin setup, and HTTPS are the operator's responsibility.
#   - This is a single-node installation; multi-node Swarm networking needs
#     separate peer-restricted configuration.
#
# QUICK START
#   Audit only:  sudo bash caprover-install.sh --check
#   Interactive: sudo bash caprover-install.sh --accept-terms
#   Unattended:  sudo bash caprover-install.sh --yes --accept-terms
#
# Full documentation: https://caprover.com/docs-next/get-started
# =============================================================================
#
set -Eeuo pipefail
IFS=$'\n\t'

VERSION="1.0.0"
CHECK_ONLY=false
YES=false
ACCEPT_TERMS=false
EXTERNAL_CHECK=true
USE_EXISTING_SWARM=false
ALLOW_OTHER_UBUNTU=false
IMAGE="caprover/caprover:latest"
DOMAIN=""
WARNINGS=0
ERRORS=0
PUBLIC_IP=""
DOCKER_READY=false
DOCKER_MISSING=false
SWARM_ACTIVE=false
UFW_ACTIVE=false
HAS_CURL=false

# Use ANSI color only when the actual output stream is an interactive terminal.
# Honor NO_COLOR and leave redirected output plain for logs and automation.
# Messages are always treated as data, never as printf format strings.
print_fail() {
  if [[ -t 1 && -n "${TERM:-}" && "${TERM:-}" != dumb && -z "${NO_COLOR:-}" ]]; then
    printf '\033[31m[FAIL] %s\033[0m\n' "$*"
  else
    printf '[FAIL] %s\n' "$*"
  fi
}

print_warn() {
  if [[ -t 1 && -n "${TERM:-}" && "${TERM:-}" != dumb && -z "${NO_COLOR:-}" ]]; then
    printf '\033[33m[WARN] %s\033[0m\n' "$*"
  else
    printf '[WARN] %s\n' "$*"
  fi
}

usage() {
  cat <<'HELP'
CapRover safe single-node installer

Usage: sudo bash caprover-install.sh [OPTIONS]

  --check                 Audit only. No installations, firewall changes or files written.
  --yes                   Skip installation confirmation ([Y/n] defaults Yes; requires --accept-terms).
  --accept-terms          Confirm acceptance of CapRover's terms for the install.
  --skip-external-check   Skip the default post-install TCP reachability tests (check-host.net).
  --domain DOMAIN         Check wildcard DNS for the future root domain (e.g. apps.example.com).
  --image IMAGE           CapRover image; default caprover/caprover:latest.
  --use-existing-swarm    Allow an EMPTY, SINGLE-NODE manager Swarm (explicit opt-in).
  --allow-other-ubuntu    Permit an Ubuntu release other than tested Ubuntu 24.04.
  -h, --help              Show help.

Fatal conditions include: unsupported architecture/OS, insufficient RAM/disk,
port conflicts, pre-existing CapRover data, unsafe Docker state and pre-existing
nonempty Swarm. Existing Docker workloads are preserved.

UFW: if active, allow 80/tcp, 443/tcp and 3000/tcp only. If inactive, leave it
inactive. The hosting-provider firewall must also permit these ports. SSH rules
and other firewall policies are never modified. Multi-node Swarm and port 996
require deliberate, restricted firewall configuration after installation.
HELP
}

while (($#)); do
  case "$1" in
    --check) CHECK_ONLY=true ;;
    --yes) YES=true ;;
    --accept-terms) ACCEPT_TERMS=true ;;
    --skip-external-check) EXTERNAL_CHECK=false ;;
    --use-existing-swarm) USE_EXISTING_SWARM=true ;;
    --allow-other-ubuntu) ALLOW_OTHER_UBUNTU=true ;;
    --domain)
      [[ $# -ge 2 ]] || { print_fail 'Missing --domain value' >&2; exit 2; }
      DOMAIN="$2"; shift ;;
    --image)
      [[ $# -ge 2 ]] || { print_fail 'Missing --image value' >&2; exit 2; }
      IMAGE="$2"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) print_fail "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

# Avoid malicious or accidental shell option-like image names and whitespace.
if [[ ! "$IMAGE" =~ ^[[:alnum:]][[:alnum:]_.:/@-]*$ ]]; then
  print_fail 'Invalid --image value' >&2; exit 2
fi
if [[ -n "$DOMAIN" && ! "$DOMAIN" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]]; then
  print_fail 'Invalid domain syntax' >&2; exit 2
fi

is_cmd() { command -v "$1" >/dev/null 2>&1; }
ok()    { printf '[ OK ] %s\n' "$*"; }
info()  { printf '[INFO] %s\n' "$*"; }
warn()  { print_warn "$*"; WARNINGS=$((WARNINGS+1)); }
error() { print_fail "$*"; ERRORS=$((ERRORS+1)); }
section() { printf '\n========== %s ==========\n' "$*"; }

summary() {
  printf '\nPreflight summary: %s error(s), %s warning(s)\n' "$ERRORS" "$WARNINGS"
  if ((ERRORS > 0)); then
    printf 'Installation blocked. Resolve [FAIL] items and rerun.\n'
    return 1
  fi
  return 0
}

# Installing on a host that passed preflight is the ordinary safe path.
# Blank input accepts it; EOF and unrecognized replies cancel safely.
confirm_installation() {
  local response
  printf '\nChanges: install/start Docker if necessary, allow 80/443/3000 in active UFW, start CapRover.\n'
  if ! read -r -p 'Proceed? [Y/n] ' response; then
    info 'No answer received. Cancelled before installation.'
    return 2
  fi
  if [[ -n "$response" && ! "$response" =~ ^[Yy]([Ee][Ss])?$ ]]; then
    info 'Cancelled before installation.'
    return 2
  fi
  return 0
}

check_machine() {
  section 'Host and operating system'
  [[ ${EUID:-$(id -u)} -eq 0 ]] || error 'Run as root: sudo bash caprover-install.sh ...'

  if [[ ! -r /etc/os-release ]]; then
    error 'Cannot read /etc/os-release'
    return
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  local os_id="${ID:-unknown}" os_version="${VERSION_ID:-unknown}"
  if [[ "$os_id" != ubuntu ]]; then
    error "Detected $os_id $os_version. This installer supports Ubuntu only."
  elif [[ "$os_version" == 24.04 ]]; then
    ok 'Ubuntu 24.04 (tested installation target)'
  elif [[ "$ALLOW_OTHER_UBUNTU" == true ]]; then
    warn "Ubuntu $os_version is outside the tested CapRover target; proceeding by request."
  else
    error "Ubuntu $os_version detected. Use Ubuntu 24.04, or pass --allow-other-ubuntu after reviewing compatibility."
  fi

  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|aarch64) ok "Supported CPU architecture: $arch" ;;
    *) error "Unsupported architecture $arch (requires x86_64/amd64 or aarch64/arm64)" ;;
  esac

  if grep -qi microsoft /proc/version 2>/dev/null; then
    error 'WSL detected. Use a Linux VPS, rather than WSL.'
  fi
  if is_cmd systemd-detect-virt && systemd-detect-virt --container --quiet 2>/dev/null; then
    error 'Already inside a container (LXC/Docker/etc.). Nested Docker/Swarm networking is unsupported by this installer.'
  fi

  local mem_kib mem_mib cpus disk_kib disk_mib free_inodes
  mem_kib="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || true)"
  if [[ "$mem_kib" =~ ^[0-9]+$ ]]; then
    mem_mib=$((mem_kib / 1024))
    if ((mem_mib < 1024)); then
      error "RAM: ${mem_mib} MiB (at least 1 GiB needed)"
    elif ((mem_mib < 2048)); then
      warn "RAM: ${mem_mib} MiB; consider 2+ GiB or swap for source builds."
    else
      ok "RAM: ${mem_mib} MiB"
    fi
  else
    error 'Cannot determine installed RAM'
  fi

  cpus="$(nproc 2>/dev/null || echo 0)"
  if [[ "$cpus" =~ ^[0-9]+$ ]] && ((cpus >= 1)); then
    if ((cpus == 1)); then warn '1 available CPU; concurrent builds may be slow.'
    else ok "$cpus available CPUs"; fi
  else
    error 'Cannot determine usable CPUs'
  fi

  local disk_path=/
  [[ -d /var/lib/docker ]] && disk_path=/var/lib/docker
  disk_kib="$(df -Pk "$disk_path" 2>/dev/null | awk 'NR==2{print $4}')"
  if [[ "$disk_kib" =~ ^[0-9]+$ ]]; then
    disk_mib=$((disk_kib / 1024))
    if ((disk_mib < 5120)); then
      error "Only ${disk_mib} MiB free on $disk_path (require 5 GiB free)."
    elif ((disk_mib < 10240)); then
      warn "${disk_mib} MiB free on $disk_path; 10+ GiB recommended for image builds."
    else
      ok "Disk free on $disk_path: ${disk_mib} MiB"
    fi
  else
    error "Cannot determine disk space on $disk_path"
  fi

  free_inodes="$(df -Pi "$disk_path" 2>/dev/null | awk 'NR==2{print $4}')"
  if [[ "$free_inodes" =~ ^[0-9]+$ ]] && ((free_inodes < 10000)); then
    error "Very few free inodes ($free_inodes) on $disk_path"
  fi

  if [[ -e /captain ]]; then
    if [[ ! -d /captain ]]; then
      error '/captain exists and is not a directory'
    elif [[ -n "$(find /captain -mindepth 1 -maxdepth 2 -print -quit 2>/dev/null)" ]]; then
      error '/captain already contains files; existing installation/data requires manual review.'
    else
      ok '/captain exists and is empty'
    fi
  else
    ok '/captain path is available'
  fi

  if [[ ! -d /sys/fs/cgroup ]]; then
    error 'Cgroups are unavailable; Docker requires working cgroups.'
  fi
  if [[ ! -S /run/systemd/private ]] && ! is_cmd systemctl; then
    warn 'systemd does not seem available; automatic Docker service start may fail.'
  fi
  if is_cmd timedatectl; then
    local ntp
    ntp="$(timedatectl show -p NTPSynchronized --value 2>/dev/null || true)"
    [[ "$ntp" != no ]] || warn 'Clock reports NTP not synchronized; HTTPS/TLS can fail if time is wrong.'
  fi
  if [[ -e /swapfile ]]; then info 'Existing swapfile found; it will not be touched.'; fi
  if is_cmd sysctl; then
    local forwarding
    forwarding="$(sysctl -n net.ipv4.ip_forward 2>/dev/null || true)"
    [[ "$forwarding" != 0 ]] || warn 'IPv4 forwarding is off. Docker normally enables it; the installer will recheck Docker networking.'
  fi
  if is_cmd modprobe && [[ ! -d /sys/module/vxlan ]]; then
    if ! modprobe -n vxlan >/dev/null 2>&1; then
      warn 'VXLAN kernel module may be unavailable; Docker Swarm overlay networks could fail.'
    fi
  fi
}

check_network() {
  section 'Networking and public address'
  is_cmd ip || { error 'iproute2 (ip) is missing; cannot inspect host networking.'; return; }
  is_cmd ss || { error 'iproute2 (ss) is missing; cannot inspect listening ports.'; return; }

  local addresses local_ip
  addresses="$(ip -4 -o addr show scope global 2>/dev/null | awk '{split($4,a,"/");print a[1]}' || true)"
  if [[ -z "$addresses" ]]; then
    error 'No configured global-scope IPv4 interface found.'
  else
    info "Host IPv4 interface address(es): $(echo "$addresses" | paste -sd, -)"
  fi
  local_ip="$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n1 || true)"
  [[ -z "$local_ip" ]] || info "Default outbound IPv4 source: $local_ip"

  if ip -4 route show default 2>/dev/null | grep -q .; then
    ok 'Default IPv4 route exists'
  else
    error 'No default IPv4 route found.'
  fi

  HAS_CURL=false
  if is_cmd curl; then
    HAS_CURL=true
    # Egress-IP echo is helpful for diagnosis, but is NOT a port-open check.
    PUBLIC_IP="$(curl -4fsSL --connect-timeout 3 --max-time 6 https://ipconfig.io/ip 2>/dev/null | tr -d '\r\n' || true)"
    if [[ ! "$PUBLIC_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
      PUBLIC_IP="$(curl -4fsSL --connect-timeout 3 --max-time 6 https://api.ipify.org 2>/dev/null | tr -d '\r\n' || true)"
    fi
    if [[ "$PUBLIC_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
      ok "Observed public egress IPv4: $PUBLIC_IP (IP echo only)"
      if [[ -n "$addresses" ]] && ! grep -Fxq "$PUBLIC_IP" <<< "$addresses"; then
        warn 'Public egress IP is not on a local interface: NAT, floating IP or cloud mapping is possible. Verify inbound forwarding.'
      fi
    else
      PUBLIC_IP=""
      warn 'Public IPv4 echo unavailable; check outbound HTTPS and the provider-assigned public IP.'
    fi
  else
    warn 'curl missing; Docker installation can add it, but public-IP lookup and external verification are unavailable now.'
  fi

  if [[ -n "$DOMAIN" ]]; then
    if ! is_cmd getent; then
      warn 'getent unavailable; cannot check wildcard DNS.'
    else
      local dns_addr
      dns_addr="$(getent ahostsv4 "probe-$(date +%s).${DOMAIN}" 2>/dev/null | awk '{print $1}' | sort -u | paste -sd, - || true)"
      if [[ -z "$dns_addr" ]]; then
        warn "Wildcard DNS for *.${DOMAIN} does not resolve yet; create DNS-only A record."
      elif [[ -n "$PUBLIC_IP" && ",$dns_addr," != *",$PUBLIC_IP,"* ]]; then
        warn "Wildcard DNS *.${DOMAIN} resolves to $dns_addr, public egress IP is $PUBLIC_IP. Confirm cloud NAT/floating-IP mapping."
      else
        ok "Wildcard DNS *.${DOMAIN} resolves to $dns_addr"
      fi
    fi
  fi
}

check_port() {
  local port="$1" proto="$2" kind="$3" result
  # Parse local endpoints from the unfiltered ss result. Some versions of
  # iproute2/kernel combinations return empty results for the ss sport filter.
  if [[ "$proto" == tcp ]]; then
    result="$(ss -H -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ (p "$")' || true)"
  else
    result="$(ss -H -lunp 2>/dev/null | awk -v p=":$port" '$4 ~ (p "$")' || true)"
  fi
  if [[ -n "$result" ]]; then
    case "$kind" in
      required) error "Port ${port}/${proto} already in use: $(echo "$result" | head -n 2 | tr '\n' ';')" ;;
      optional) warn "Optional ${port}/${proto} already in use; HTTP/3 might not work: $(echo "$result" | head -n1)" ;;
    esac
  else
    ok "Port ${port}/${proto} has no host listener"
  fi
}

check_ports() {
  section 'Port conflicts (listeners)' 
  if ! is_cmd ss; then error 'Missing ss; port safety audit incomplete.'; return; fi
  check_port 80 tcp required
  check_port 443 tcp required
  check_port 3000 tcp required
  check_port 443 udp optional
  # When Docker is in inactive Swarm mode, these ports must be available for
  # Swarm initialization even though a single-node install need not expose them.
  if [[ "$SWARM_ACTIVE" == false ]]; then
    check_port 2377 tcp required
    check_port 7946 tcp required
    check_port 7946 udp required
    check_port 4789 udp required
  else
    info 'Existing Swarm owns its internal ports; skipping checks for 2377/7946/4789.'
  fi
}

check_firewall() {
  section 'Firewall and packet filtering'
  UFW_ACTIVE=false
  if is_cmd ufw; then
    local status
    status="$(ufw status 2>&1 || true)"
    if grep -qi '^Status: active' <<< "$status"; then
      UFW_ACTIVE=true
      ok 'UFW is active; installer will add specific public TCP allows.'
      # Explicit DENY rules require operator review; appending an ALLOW may not win.
      if grep -Ei '(^|[[:space:]])(80|443|3000)(/tcp|[[:space:]])' <<< "$status" | grep -Eqi 'DENY|REJECT'; then
        error 'UFW contains a DENY/REJECT on a CapRover TCP port. Review rule order manually: ufw status numbered'
      fi
    elif grep -qi '^Status: inactive' <<< "$status"; then
      warn 'UFW is inactive. Will leave it inactive; review hosting-provider firewall and iptables/nftables.'
    else
      warn 'UFW status unreadable; firewall will not be modified.'
    fi
  else
    warn 'UFW not installed. It will not be installed/enabled automatically.'
  fi
  if is_cmd firewall-cmd && firewall-cmd --state 2>/dev/null | grep -qx running; then
    warn 'firewalld is active. Configure its public TCP rules explicitly; installer will not modify firewalld.'
  fi
  if is_cmd iptables; then
    local input_rules
    input_rules="$(iptables -S INPUT 2>/dev/null || true)"
    if [[ -z "$input_rules" ]]; then
      warn 'iptables INPUT rules could not be read.'
    else
      if grep -q '^-P INPUT DROP\|^-P INPUT REJECT' <<< "$input_rules"; then
        warn 'iptables INPUT default policy drops traffic; check effective allow rules and cloud firewall.'
      fi
      if grep -Eq -- '^-A INPUT .* -j (DROP|REJECT)( |$)' <<< "$input_rules"; then
        warn 'iptables INPUT contains explicit DROP/REJECT rules; check precedence for CapRover ports.'
      fi
    fi
  else
    warn 'iptables not available for inspection; Docker may install it later.'
  fi
  if is_cmd nft; then
    if nft -a list ruleset 2>/dev/null | grep -Eq 'hook input.*policy drop|hook input.*policy reject'; then
      warn 'nftables has an input drop/reject policy. Check rules with: nft list ruleset'
    fi
  fi
  if [[ -f /etc/ufw/ufw.conf ]] && grep -q '^IPV6=no' /etc/default/ufw 2>/dev/null; then
    warn 'UFW IPv6 filtering is off. Review any publicly routable IPv6 addresses.'
  fi
  info 'Cloud firewalls/security groups are not locally inspectable.'
  info 'Do not publicly open 2377/tcp, 7946/tcp+udp, 4789/udp or registry 996/tcp for a single-node installation.'
  info 'Docker published ports may bypass UFW. Restrict them at the provider or via Docker-aware rules.'
}

is_installed_pkg() {
  [[ "$(dpkg-query -W -f='${db:Status-Abbrev}' "$1" 2>/dev/null || true)" == ii* ]]
}

check_docker() {
  section 'Docker state and existing workloads'
  DOCKER_READY=false
  DOCKER_MISSING=false
  SWARM_ACTIVE=false
  if ! is_cmd docker; then
    DOCKER_MISSING=true
    info 'Docker CLI not found. Official Docker CE will be installed in install mode.'
    if is_cmd snap && snap list docker 2>/dev/null | grep -q '^docker[[:space:]]'; then
      error 'Docker snap installation detected. Remove/migrate it manually before installing Docker CE.'
    fi
    if is_cmd dpkg-query; then
      local conflicts=() pkg
      for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd containerd.io runc docker-ce docker-ce-cli; do
        if is_installed_pkg "$pkg"; then conflicts+=("$pkg"); fi
      done
      if ((${#conflicts[@]})); then
        error "Conflicting/pre-existing runtime packages detected: ${conflicts[*]}. Review/remove manually; installer will not uninstall packages."
      fi
    fi
    if [[ -d /var/lib/docker ]] && [[ -n "$(find /var/lib/docker -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
      error '/var/lib/docker already contains data but Docker CLI is missing. Manual inspection required.'
    fi
    return
  fi

  local docker_path context_host
  docker_path="$(command -v docker)"
  if [[ -n "${DOCKER_HOST:-}" && "${DOCKER_HOST}" != 'unix:///var/run/docker.sock' ]]; then
    error "DOCKER_HOST points to ${DOCKER_HOST}; only the local /var/run/docker.sock is supported. Unset DOCKER_HOST."
    return
  fi
  if [[ -n "${DOCKER_CONTEXT:-}" && "${DOCKER_CONTEXT}" != default ]]; then
    error "DOCKER_CONTEXT=${DOCKER_CONTEXT} could point to another host. Unset DOCKER_CONTEXT."
    return
  fi
  context_host="$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)"
  if [[ -n "$context_host" && "$context_host" != 'unix:///var/run/docker.sock' ]]; then
    error "Docker context endpoint is $context_host; switch to the local default context before installing."
    return
  fi
  if [[ "$docker_path" == /snap/* ]] || (is_cmd snap && snap list docker 2>/dev/null | grep -q '^docker[[:space:]]'); then
    error "Docker installed via snap ($docker_path); unsupported for CapRover."
    return
  fi
  if ! docker info >/dev/null 2>&1; then
    warn 'Docker CLI found but daemon is unreachable. In install mode the script will try starting docker.service.'
    if [[ "$CHECK_ONLY" == true ]]; then
      error 'Cannot inspect existing containers or Swarm while Docker is down. Start Docker and repeat --check.'
    fi
    return
  fi

  DOCKER_READY=true
  local server_version major rootless state control containers services nodes service_count
  server_version="$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
  major="${server_version%%.*}"
  if [[ "$major" =~ ^[0-9]+$ ]] && ((major >= 25)); then
    ok "Docker Engine server version: $server_version"
  else
    error "Docker server $server_version is below the required 25.x. Upgrade explicitly; installer will preserve existing Engine."
  fi
  rootless="$(docker info --format '{{json .SecurityOptions}}' 2>/dev/null || true)"
  if [[ "$rootless" == *rootless* ]]; then
    error 'Rootless Docker detected; CapRover needs a rootful Docker daemon and socket.'
  fi
  [[ -S /var/run/docker.sock ]] || error 'Docker UNIX socket /var/run/docker.sock is missing.'
  if is_cmd sysctl && [[ "$(sysctl -n net.ipv4.ip_forward 2>/dev/null || true)" == 0 ]]; then
    error 'Docker is running with net.ipv4.ip_forward=0; Docker/Swarm ingress networking may fail.'
  fi
  if [[ -r /etc/docker/daemon.json ]] && is_cmd python3; then
    local daemon_network_config
    daemon_network_config="$(python3 - <<'PYJSON'
import json
try:
    with open('/etc/docker/daemon.json') as f:
        data=json.load(f)
    print('disabled' if data.get('iptables') is False or data.get('ip-forward') is False else 'ok')
except Exception:
    print('unknown')
PYJSON
)"
    if [[ "$daemon_network_config" == disabled ]]; then
      error 'Docker daemon.json disables iptables or IP forwarding; CapRover networking needs review.'
    elif [[ "$daemon_network_config" == unknown ]]; then
      warn 'Docker daemon.json could not be parsed. Review Docker networking settings.'
    fi
  fi

  state="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || true)"
  case "$state" in
    inactive) ok 'Docker Swarm is inactive; CapRover will initialize it.' ;;
    active)
      SWARM_ACTIVE=true
      control="$(docker info --format '{{.Swarm.ControlAvailable}}' 2>/dev/null || true)"
      if [[ "$control" != true ]]; then
        error 'Existing Swarm node is not a manager; CapRover requires a manager.'
      elif [[ "$USE_EXISTING_SWARM" != true ]]; then
        error 'Swarm already active. Use a fresh host, or explicitly pass --use-existing-swarm for an empty single-node manager.'
      else
        services="$(docker service ls --format '{{.Name}}' 2>/dev/null || true)"
        nodes="$(docker node ls -q 2>/dev/null | wc -l | tr -d ' ')"
        service_count="$(printf '%s\n' "$services" | sed '/^$/d' | wc -l | tr -d ' ')"
        if ((service_count > 0)); then
          error "Swarm already has $service_count service(s): $(echo "$services" | head -n 5 | paste -sd, -). Existing services must be preserved."
        elif [[ "$nodes" != 1 ]]; then
          error "Swarm has $nodes node(s). This installer supports only a single-node manager."
        else
          ok 'Existing Swarm is a single-manager node with zero services; explicit reuse requested.'
        fi
      fi ;;
    *) error "Unexpected Swarm state: ${state:-unknown}. Investigate Docker before proceeding." ;;
  esac

  containers="$(docker ps -a --format '{{.Names}}|{{.Status}}|{{.Ports}}' 2>/dev/null || true)"
  if [[ -n "$containers" ]]; then
    warn "Docker contains pre-existing containers: $(echo "$containers" | head -n 8 | paste -sd';' -). None will be removed."
    if grep -Eq '^caprover-bootstrap\|' <<< "$containers"; then
      error 'caprover-bootstrap container already exists; inspect: docker logs caprover-bootstrap. Investigate/remove manually if stale.'
    fi
    if grep -Eq '^captain-(captain|nginx|certbot)\|' <<< "$containers"; then
      error 'CapRover containers may already exist. Refusing to reinstall.'
    fi
  else
    ok 'No existing Docker containers'
  fi

  # Docker can publish host ports entirely via NAT (userland proxy disabled),
  # with no corresponding `ss` listener. Detect bindings independently.
  local published port
  published="$(docker ps --format '{{.Names}}|{{.Ports}}' 2>/dev/null || true)"
  for port in 80 443 3000; do
    if grep -Eq "(^|[[:space:],])[^,[:space:]]+:${port}->[0-9]+/tcp" <<< "$published"; then
      error "Running Docker container already publishes host TCP port $port: $(grep -E "(^|[[:space:],])[^,[:space:]]+:${port}->[0-9]+/tcp" <<< "$published" | head -n2 | paste -sd';' -)"
    fi
  done

  if [[ "$SWARM_ACTIVE" == true ]]; then
    services="$(docker service ls --format '{{.Name}}' 2>/dev/null || true)"
    if grep -Eq '^captain-(captain|nginx|certbot)$' <<< "$services"; then
      error 'CapRover services already exist. Refusing to reinstall.'
    fi
  fi
}

start_existing_docker() {
  if [[ "$DOCKER_READY" == true || "$DOCKER_MISSING" == true ]]; then return; fi
  section 'Recovery: Docker daemon'
  if is_cmd systemctl && systemctl list-unit-files docker.service --no-legend 2>/dev/null | grep -q '^docker.service'; then
    info 'Attempting to start the existing Docker daemon (no package upgrade).'
    systemctl start docker || { error 'Docker service failed to start. Check: journalctl -u docker -xe'; return; }
  else
    error 'Docker daemon unreachable; no docker.service available to start automatically.'
    return
  fi
  sleep 2
  check_docker
}

install_docker() {
  [[ "$DOCKER_MISSING" == true ]] || return 0
  section 'Installing official Docker Engine'
  is_cmd apt-get || { error 'apt-get unavailable. Docker installation is supported on Ubuntu only.'; return 1; }
  local os_id os_codename arch key_tmp
  # shellcheck disable=SC1091
  . /etc/os-release
  os_id="${ID:-}"
  os_codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
  [[ "$os_id" == ubuntu && -n "$os_codename" ]] || { error 'Cannot determine Ubuntu codename for Docker apt repository.'; return 1; }

  # This is deliberate: no automatic uninstall/replacement of existing runtimes.
  if [[ -e /etc/apt/sources.list.d/docker.sources ]]; then
    if ! grep -Fq 'https://download.docker.com/linux/ubuntu' /etc/apt/sources.list.d/docker.sources; then
      error 'Existing docker.sources is custom/unknown; investigate manually.'; return 1
    fi
    info 'Using existing official Docker apt source.'
  fi

  export DEBIAN_FRONTEND=noninteractive
  if ! apt-get update; then error 'apt-get update failed; inspect configured repositories and network.'; return 1; fi
  if ! apt-get install -y ca-certificates curl; then error 'Could not install ca-certificates/curl.'; return 1; fi
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -s /etc/apt/keyrings/docker.asc ]]; then
    key_tmp="$(mktemp /etc/apt/keyrings/.docker.asc.XXXXXX)"
    if ! curl -fsSL --connect-timeout 10 --max-time 40 https://download.docker.com/linux/ubuntu/gpg -o "$key_tmp"; then
      rm -f "$key_tmp"; error 'Failed to download official Docker signing key.'; return 1
    fi
    if ! grep -q 'BEGIN PGP PUBLIC KEY BLOCK' "$key_tmp"; then
      rm -f "$key_tmp"; error 'Docker signing key response is invalid.'; return 1
    fi
    install -m 0644 "$key_tmp" /etc/apt/keyrings/docker.asc
    rm -f "$key_tmp"
  else
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  if [[ ! -e /etc/apt/sources.list.d/docker.sources ]]; then
    arch="$(dpkg --print-architecture)"
    cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $os_codename
Components: stable
Architectures: $arch
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  fi
  if ! apt-get update; then error 'Could not refresh Docker apt repository.'; return 1; fi
  if ! apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
    error 'Docker Engine package installation failed. Inspect apt output; no existing runtimes were removed.'
    return 1
  fi
  if is_cmd systemctl; then systemctl enable --now docker; fi
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if docker info >/dev/null 2>&1; then break; fi
    sleep 2
  done
  if ! docker info >/dev/null 2>&1; then
    error 'Docker installed but daemon is not responding. Check journalctl -u docker.'
    return 1
  fi
  DOCKER_MISSING=false
  ok 'Docker installed and daemon responding.'
}

apply_ufw_rules() {
  section 'Applying safe firewall changes'
  if [[ "$UFW_ACTIVE" != true ]]; then
    warn 'UFW inactive/unavailable. No guest firewall rules applied; verify external firewall manually.'
    return
  fi
  # UFW adds rules idempotently (reports "Skipping adding existing rule").
  local p rules matching
  rules="$(ufw status 2>/dev/null || true)"
  for p in 80 443 3000; do
    # Preserve restricted IPv4 source-address allow rules. A global allow could
    # silently widen access, especially to the admin port 3000. Ignore IPv6-only
    # entries, which would leave IPv4 blocked if considered sufficient.
    matching="$(grep -E "(^|[[:space:]])${p}/tcp([[:space:]]|$)" <<< "$rules" | grep -v '(v6)' | grep 'ALLOW' || true)"
    if [[ -n "$matching" ]]; then
      if grep -Eq 'Anywhere|0\.0\.0\.0/0' <<< "$matching"; then
        info "Existing UFW ${p}/tcp allow preserved."
      else
        warn "Existing UFW ${p}/tcp allow is restricted to specific sources. Preserving restriction; ensure your client can connect."
      fi
      continue
    fi
    ufw allow "$p/tcp" || { error "Could not allow $p/tcp with UFW"; return 1; }
  done
  ok 'UFW public TCP port rules reviewed/applied; existing source restrictions preserved.'
  info '443/udp (HTTP/3) remains optional and unchanged.'
}

configure_existing_swarm() {
  [[ "$SWARM_ACTIVE" == true && "$USE_EXISTING_SWARM" == true ]] || return 0
  section 'Configuring opt-in existing Swarm'
  is_cmd python3 || { error 'python3 required to safely merge CapRover config override.'; return 1; }
  install -d -m 0755 /captain/data
  # Newly created /captain/data should be empty; preflight blocked old /captain data.
  python3 - <<'PY'
import json, os, tempfile
path = '/captain/data/config-override.json'
if os.path.lexists(path):
    raise SystemExit('Unexpected pre-existing config override; refusing overwrite')
config = {'useExistingSwarm': True}
fd, tmp = tempfile.mkstemp(prefix='.config-override-', dir='/captain/data')
try:
    with os.fdopen(fd, 'w') as f:
        json.dump(config, f, indent=2)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())
    os.chmod(tmp, 0o644)
    os.replace(tmp, path)
finally:
    if os.path.exists(tmp):
        os.unlink(tmp)
PY
  ok 'Created /captain/data/config-override.json with useExistingSwarm=true.'
}

wait_for_captain() {
  section 'Verifying CapRover deployment'
  local i state status count=0
  for ((i=1; i<=90; i++)); do
    # The bootstrap container may exit after creating the Swarm services.
    if docker service inspect captain-captain >/dev/null 2>&1; then
      status="$(docker service ps captain-captain --no-trunc --format '{{.CurrentState}}' 2>/dev/null | head -n1 || true)"
      if [[ "$status" == Running* ]]; then
        count=$((count+1))
        if ((count >= 2)); then
          ok 'captain-captain service task is running.'
          break
        fi
      fi
    fi
    state="$(docker inspect --format '{{.State.Status}}:{{.State.ExitCode}}' caprover-bootstrap 2>/dev/null || true)"
    if [[ "$state" == exited:* && "$state" != exited:0 ]]; then
      error "Installer bootstrap exited unsuccessfully ($state). Read: docker logs caprover-bootstrap"
      docker logs --tail 40 caprover-bootstrap 2>&1 || true
      return 1
    fi
    sleep 2
  done
  if ((i > 90)); then
    error 'CapRover service did not reach Running within 3 minutes.'
    info 'Inspect: docker logs caprover-bootstrap; docker service ps captain-captain --no-trunc'
    return 1
  fi
  # HTTP readiness may lag behind the Swarm task status.
  if is_cmd curl; then
    local code=''
    for ((i=1; i<=30; i++)); do
      code="$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 --max-time 4 http://127.0.0.1:3000 2>/dev/null || true)"
      if [[ "$code" =~ ^[23][0-9][0-9]$ || "$code" == 401 || "$code" == 403 ]]; then
        ok "Local dashboard responds on port 3000 (HTTP $code)."
        return 0
      fi
      sleep 2
    done
    error 'Swarm task running, but local port 3000 did not answer HTTP. Check service logs and firewall.'
    return 1
  else
    warn 'curl unavailable for local dashboard smoke test.'
  fi
}

external_port_test() {
  local port="$1" response request_id result status try
  response="$(curl -fsSL --connect-timeout 6 --max-time 12 -H 'Accept: application/json' \
    "https://check-host.net/check-tcp?host=${PUBLIC_IP}:${port}&max_nodes=3" 2>/dev/null || true)"
  request_id="$(printf '%s' "$response" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("request_id", ""))' 2>/dev/null || true)"
  if [[ ! "$request_id" =~ ^[A-Za-z0-9_-]+$ ]]; then
    warn "External ${port}/tcp test was rejected/unavailable."
    return
  fi
  status=pending
  for try in 1 2 3 4 5 6; do
    sleep 2
    result="$(curl -fsSL --connect-timeout 6 --max-time 12 -H 'Accept: application/json' \
      "https://check-host.net/check-result/${request_id}" 2>/dev/null || true)"
    status="$(printf '%s' "$result" | python3 -c '
import json,sys
try: data=json.load(sys.stdin)
except Exception: print("pending"); sys.exit()
completed=0
pending=0
for checks in data.values():
    if checks is None:
        pending+=1
        continue
    if not isinstance(checks,list):
        pending+=1
        continue
    for check in checks:
        if not isinstance(check,dict): continue
        completed+=1
        if "time" in check and "error" not in check:
            print("open"); sys.exit()
print("pending" if pending else ("closed" if completed else "pending"))
' 2>/dev/null || true)"
    [[ "$status" != pending ]] && break
  done
  case "$status" in
    open) ok "External test: ${PUBLIC_IP}:${port}/tcp reachable from at least one check-host.net node." ;;
    closed) warn "External test: ${PUBLIC_IP}:${port}/tcp not reachable from tested nodes. Check provider firewall, NAT, service readiness; report https://check-host.net/check-report/$request_id" ;;
    *) warn "External test inconclusive for ${PUBLIC_IP}:${port}/tcp (timeout or pending)." ;;
  esac
}

external_reachability() {
  [[ "$EXTERNAL_CHECK" == true ]] || return 0
  section 'Independent external reachability (default post-install)'
  if [[ -z "$PUBLIC_IP" ]] && is_cmd curl; then
    PUBLIC_IP="$(curl -4fsSL --max-time 8 https://api.ipify.org 2>/dev/null | tr -d '\r\n' || true)"
  fi
  if [[ ! "$PUBLIC_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    warn 'No usable public IPv4 echo. External tests skipped.'
    return
  fi
  if ! is_cmd curl || ! is_cmd python3; then
    warn 'External tests require curl and python3.'
    return
  fi
  info "Testing $PUBLIC_IP via third-party check-host.net (not via localhost, and not using ipconfig.io as a port test)."
  external_port_test 80
  external_port_test 443
  external_port_test 3000
  info 'TCP reachability cannot prove correct HTTP routing or HTTPS certificate. UDP port 443 and Swarm peer reachability require separate tests.'
}

main() {
  printf 'CapRover installer v%s\n' "$VERSION"
  info 'Target: clean Ubuntu 24.04, single-node Docker Swarm. No removal of existing workloads.'
  if [[ "$CHECK_ONLY" == false && "$YES" == true && "$ACCEPT_TERMS" == false ]]; then
    print_fail '--yes requires --accept-terms.' >&2
    return 2
  fi

  check_machine
  check_network
  check_docker
  check_ports
  check_firewall

  if [[ "$CHECK_ONLY" == true ]]; then
    info '--check skips external reachability tests because CapRover has not been deployed by this run.'
    summary
    printf 'Audit complete. No changes were made.\n'
    return 0
  fi

  summary || return 1
  if [[ "$ACCEPT_TERMS" != true ]]; then
    if [[ ! -t 0 ]]; then
      error 'Non-interactive installation requires --accept-terms.'
      return 2
    fi
    local terms
    read -r -p 'Do you accept CapRover terms and authorize installation? [y/N] ' terms
    if [[ ! "$terms" =~ ^[Yy]([Ee][Ss])?$ ]]; then
      info 'Cancelled before installation.'; return 2
    fi
  fi
  if [[ "$YES" != true ]]; then
    if [[ ! -t 0 ]]; then
      error 'Non-interactive installation requires --yes --accept-terms.'
      return 2
    fi
    confirm_installation || return 2
  fi

  if [[ "$DOCKER_MISSING" == true ]]; then
    install_docker || return 1
    check_docker
    ((ERRORS == 0)) || { summary || true; return 1; }
  elif [[ "$DOCKER_READY" == false ]]; then
    start_existing_docker
    ((ERRORS == 0)) || { summary || true; return 1; }
  fi

  # Docker may have changed its listeners or firewall; audit again immediately
  # before any CapRover or UFW change.
  check_ports
  ((ERRORS == 0)) || { summary || true; return 1; }
  apply_ufw_rules || return 1
  ((ERRORS == 0)) || { summary || true; return 1; }
  configure_existing_swarm || return 1

  section 'Installing CapRover'
  install -d -m 0755 /captain
  info "Pulling $IMAGE"
  if ! docker pull "$IMAGE"; then error "Failed pulling $IMAGE. Check registry access/DNS."; return 1; fi
  info 'Starting CapRover bootstrap container. Swarm and CapRover services are initialized by CapRover.'
  if ! docker run -d --name caprover-bootstrap \
    --publish 80:80 --publish 443:443 --publish 3000:3000 \
    --env ACCEPTED_TERMS=true \
    --volume /var/run/docker.sock:/var/run/docker.sock \
    --volume /captain:/captain \
    "$IMAGE" >/dev/null; then
    error 'CapRover bootstrap docker run failed. Check port mappings, Docker logs and existing containers.'
    return 1
  fi
  wait_for_captain || return 1
  external_reachability

  section 'Installation summary'
  ok 'CapRover bootstrap completed; the Swarm service is running.'
  if [[ -n "$PUBLIC_IP" ]]; then
    printf 'Dashboard: http://%s:3000\n' "$PUBLIC_IP"
  else
    printf 'Dashboard: http://YOUR_PUBLIC_SERVER_IP:3000\n'
  fi
  printf 'Initial password: captain42 (change immediately)\n'
  printf 'Next: configure wildcard A record, root domain, HTTPS, then close/restrict port 3000.\n'
  printf 'Diagnostics: docker service ls; docker service ps captain-captain; docker logs caprover-bootstrap\n'
  printf 'Final summary: %d error(s), %d warning(s).\n' "$ERRORS" "$WARNINGS"
}

main "$@"
