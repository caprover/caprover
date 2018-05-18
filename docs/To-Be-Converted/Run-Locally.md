In order to run CaptainDuckDuck on your local machine you need:

- Docker installed on your machine.
- A local DNS server on your machine. You need to point `*.captain.x` to `127.0.0.1` or `192.168.1.2` (your local ip). **NOTE** that `etc/hosts` won't be enough as Captain needs a wildcard entry and `etc/hosts` does not allow wildcards, i.e. `*.something`.
  - On ubuntu 16, `dnsmasq` (a local DNS server) is built-in. So, it's as simple of editing this file: `/etc/NetworkManager/dnsmasq.d/dnsmasq-localhost.conf` (create if does not exist) And add this line to it: `address=/captain.x/192.168.1.2` where `192.168.1.2` is your local IP address. To make sure you have `dnsmasq`, you can run `which dnsmasq` on your terminal, if it's available, path of it will be printed on the terminal, otherwise, there won't be anything printed on your terminal

To verify you have both prerequisites mentioned above:
- Run `docker version` and make sure your version is at least the version mentioned in the [docs](https://github.com/githubsaturn/captainduckduck/wiki/Getting-Started#c-install-docker-on-server-at-least-version-1706x) 
- Run `nslookup askjdfklasjflk.captain.x` and make sure it resolves to `127.0.0.1` or your local ip (something like `192.168.1.2`):
```
Server:		127.0.1.1
Address:	127.0.1.1#53

Name:	askjdfklasjflk.captain.x
Address: 192.168.1.2
```


Once you confirmed that you have the prereqs ready, you can go ahead and install Captain on your machine, similar to what you do on server. Make sure you run as a user with sufficient permission, i.e. `sudo` on linux based systems. Just follow the steps outlined here:
https://github.com/githubsaturn/captainduckduck/wiki/Getting-Started#step-1-captain-installation

**EXCEPT** 
Do not run `captainduckduck serversetup`. Instead, go to http://localhost:3000 and manually set root domain to `captain.x`. DO NOT enable/force HTTPS. Obviously, you cannot enable HTTPS on your local domain (captain.x).

Once you set your root domain as `captain.x`, use `captainduckduck login` and enter `captain.captain.x` as your captain URL and captain42 as your password. 


**NON-LINUX USERS**
You need to add `/captain` to shared paths.
To do so, click on the Docker icon -> Setting -> File Sharing and add `/captain`



You are set!