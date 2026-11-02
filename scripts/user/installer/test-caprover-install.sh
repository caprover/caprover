#!/usr/bin/env bash
# Unit tests with mocked Docker / UFW / HTTP. Does not install anything.
set -euo pipefail
SCRIPT="$(cd "$(dirname "$0")" && pwd)/caprover-install.sh"
TESTS=0
PASS=0
run_test() {
  TESTS=$((TESTS+1))
  local name="$1" code="$2" got
  if got="$(SCRIPT="$SCRIPT" bash -c "$code" 2>&1)"; then
    echo "PASS $name"
    PASS=$((PASS+1))
  else
    echo "FAIL $name"
    echo "$got"
  fi
}

# The last line of the production script calls main; remove it for unit tests.
# Sourcing the definitions is safe in a child shell with no arguments.
HEADER='source <(sed '\''$d'\'' "$SCRIPT"); set +e; ERRORS=0; WARNINGS=0'

run_test 'rejects installing without explicitly accepted terms' \
 'result=$(bash "$SCRIPT" --yes 2>&1); rc=$?; [[ $rc -eq 2 && "$result" == *"--accept-terms"* ]]'

run_test 'Docker missing is recoverable' \
 "$HEADER; is_cmd() { [[ \"\$1\" != docker ]]; }; check_docker >/tmp/caprover-test-output; [[ \$DOCKER_MISSING == true && \$ERRORS -eq 0 ]]"

run_test 'port audit recognizes occupied listening TCP port' \
 "$HEADER; python3 -c 'import socket,time;s=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind((\"127.0.0.1\",39281));s.listen(1);time.sleep(5)' & pid=\$!; sleep 1; check_port 39281 tcp required >/dev/null; kill \$pid 2>/dev/null; wait \$pid 2>/dev/null; [[ \$ERRORS -eq 1 ]]"

run_test 'port audit passes an unoccupied TCP port' \
 "$HEADER; check_port 39282 tcp required >/dev/null; [[ \$ERRORS -eq 0 ]]"

run_test 'existing Swarm is blocked by default' \
 "$HEADER; docker(){ case \"\$*\" in *context* ) echo unix:///var/run/docker.sock ;; *Version* ) echo 27.2.0 ;; *SecurityOptions* ) echo '[\"name=seccomp\"]' ;; *LocalNodeState* ) echo active ;; *ControlAvailable* ) echo true ;; *info* ) return 0 ;; esac; }; check_docker >/dev/null; [[ \$ERRORS -ge 1 ]]"

run_test 'running Docker with port mapping is independently detected' \
 "$HEADER; docker(){ case \"\$*\" in *context* ) echo unix:///var/run/docker.sock ;; *Version* ) echo 27.2.0 ;; *SecurityOptions* ) echo '[\"name=seccomp\"]' ;; *LocalNodeState* ) echo inactive ;; *ps* ) echo 'example|0.0.0.0:80->8080/tcp' ;; *info* ) return 0 ;; esac; }; check_docker >/tmp/caprover-test-output; grep -q 'already publishes host TCP port 80' /tmp/caprover-test-output"

run_test 'UFW source restrictions are never widened' \
 "$HEADER; UFW_ACTIVE=true; ufw(){ if [[ \"\$1\" == status ]]; then echo 'Status: active'; echo '3000/tcp ALLOW 203.0.113.4'; else printf '%s ' \"\$@\" >> /tmp/caprover-ufw-test; echo >> /tmp/caprover-ufw-test; fi; }; rm -f /tmp/caprover-ufw-test; apply_ufw_rules >/dev/null; [[ -f /tmp/caprover-ufw-test ]] && grep -q 'allow 80/tcp' /tmp/caprover-ufw-test && grep -q 'allow 443/tcp' /tmp/caprover-ufw-test && ! grep -q '3000/tcp' /tmp/caprover-ufw-test"

run_test 'external checker treats successful TCP handshake as reachable' \
 "$HEADER; PUBLIC_IP=203.0.113.10; curl(){ if [[ \"\$*\" == *check-tcp* ]]; then echo '{\"ok\":1,\"request_id\":\"abc\"}'; else echo '{\"node\":[{\"time\":0.1,\"address\":\"203.0.113.10\"}]}' ; fi; }; sleep(){ :; }; external_port_test 80 >/tmp/caprover-external-test; grep -q 'reachable from at least one' /tmp/caprover-external-test"

run_test 'external checker treats unsuccessful TCP handshake as blocked' \
 "$HEADER; PUBLIC_IP=203.0.113.10; curl(){ if [[ \"\$*\" == *check-tcp* ]]; then echo '{\"ok\":1,\"request_id\":\"abc\"}'; else echo '{\"node\":[{\"error\":\"Connection timed out\"}]}' ; fi; }; sleep(){ :; }; external_port_test 80 >/tmp/caprover-external-test; grep -q 'not reachable from tested nodes' /tmp/caprover-external-test"

run_test 'external checks are enabled by default' \
 "$HEADER; [[ \$EXTERNAL_CHECK == true ]]"

run_test 'external checks can be disabled explicitly' \
 'set -- --skip-external-check; source <(head -n -1 "$SCRIPT"); [[ "$EXTERNAL_CHECK" == false ]]'

run_test 'script parses and displays usage' \
 'bash -n "$SCRIPT" && bash "$SCRIPT" --help | grep -q "Audit only"'

echo "$PASS/$TESTS tests passed"
[[ "$PASS" == "$TESTS" ]]
