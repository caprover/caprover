# Security Policy

## Supported Versions
Only the last version receives security patches. To receive the security patches, you must make sure that your instances is using the most recent release.

## Administrator Trust Boundary

Treat the CapRover administrator password and admin session as credentials for full control of the host. By design, administrators can deploy containers and bind-mount host directories, including the host filesystem root. Host access through these capabilities is expected behavior and is out of scope for vulnerability reports.

Reports that require an administrator to deliberately plant a malicious configuration are also out of scope when the only result is access the administrator already has. This includes reports where an app deployment token or build webhook triggers the planted configuration after the admin session ends.

Please report ways to gain admin or host access without existing administrator privileges, including cases where routine administrator actions process attacker-controlled input. If your report involves an app token or webhook, describe what the attacker starts with, what a normally configured instance requires, and how the attacker gains control of any required setting.

## Reporting a Vulnerability

Security issues are high priority and they will be addressed immediately. If you find a security issue, please do not post as a public issue, instead, please email it to us: security at caprover dot com.

