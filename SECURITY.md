# Security Policy

## Supported Versions
Only the last version receives security patches. To receive the security patches, you must make sure that your instances is using the most recent release.

## Administrator Trust Boundary

Treat the CapRover administrator password and admin session as credentials for full control of the host. By design, administrators can deploy containers and bind-mount host directories, including the host filesystem root. Host access through these capabilities is expected behavior and is out of scope for vulnerability reports.

Reports that assume the attacker already knows the valid CapRover administrator password or already has an authenticated admin session are out of scope when the claimed impact is within that administrator's existing authority. This applies whether the attacker uses those credentials to prepare the environment or to execute the attack. A flaw that lets an attacker obtain the administrator password or bypass admin authentication remains in scope.

Reports that require an administrator to deliberately grant the attacker access or prepare a malicious configuration are out of scope when that step supplies the access being claimed. Examples include an administrator opening a port specifically to expose an otherwise private privileged service to the attacker, or planting a malicious setting for an app token or build webhook to trigger later.

Remote code execution in the CapRover control plane or on the host through a crafted app token or a request authenticated with a valid app token is in scope when a non-admin attacker can achieve it on a normally configured instance. Routine setup, such as enabling an app token for CI, and routine administrator actions that process attacker-controlled input are valid prerequisites.

For app token or webhook reports, state what access the attacker starts with, which normal settings are required, and how the attacker controls any input or setting needed to cross the privilege boundary.

## Reporting a Vulnerability

Security issues are high priority and they will be addressed immediately. If you find a security issue, please do not post as a public issue, instead, please email it to us: security at caprover dot com.

CapRover Team

