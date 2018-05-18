### Firewall & Port Forwarding

Captain uses:
- 80   TCP for regular HTTP connections
- 443  TCP for secure HTTPS connections
- 3000 TCP for initial Captain Installation (can be blocked once Captain is attached to a domain)
- 7946 TCP/UDP for Container Network Discovery
- 4789 TCP/UDP for Container Overlay Network
- 2377 TCP/UDP for Docker swarm API
- 996  TCP for secure HTTPS connections specific to Docker Registry

Or simply disable firewall entirely. In case of an ubuntu server, run `ufw disable`.

Also, if you are using Port Mapping to allow external connections, for example from your laptop to a MySQL instance on Captain, you will have to add the corresponding port to the exclusion as well.