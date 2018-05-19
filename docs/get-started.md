---
id: get-started
title: Getting Started
sidebar_label: Getting Started
---

<br/>

## Prerequisites

#### A) Domain Name

During installation, you'll be asked to point a wildcard DNS entry to your Captain IP Address. If you need help with domain name, see <a href="#setup-domain-and-dns">Domain and DNS</a>. This will cost you as low as $2 a year.

#### B) Server with a Public IP

Captain has to be installed on a machine with a public IP address. If you need help with Public IP, see [Server & Public IP address](server-purchase.md). This will cost you as low as $5 a month. If you use the DigitalOcean referral code, you'll get $10 credit - two months worth of free server: https://m.do.co/c/6410aa23d3f3 

_**CPU Architecture**:_ Although CaptainDuckDuck source code is compatible with any CPU architecture, the Docker build available on Docker Hub is built for x86 CPU. Therefore, If your CPU is ARM, you can download the source code and build it on your ARM architecture in order to run it.

_**Recommended Stack**:_ CaptainDuckDuck is tested on Ubuntu 16.04 and Docker 17.06. If you're using CaptainDuckDuck on a different OS, you might want to look at [Docker Docs](https://docs.docker.com/engine/userguide/storagedriver/selectadriver/#supported-storage-drivers-per-linux-distribution).

_**Minimum RAM**:_ Note that the build process sometimes consumes too much RAM, and 512MB RAM might not be enough (see [this issue](https://github.com/githubsaturn/captainduckduck/issues/28)). Most providers offer a minimum of 1GB RAM on $5 instance including DigitalOcean, Vultr, Scaleway, Linode, SSD Nodes and etc.

You can install Captain on your laptop which is behind NAT (your router) for testing purposes, but it requires some special setup, like port forwarding. 

#### C) Install Docker on Server (at least, version 17.06.x)

If you get your server from DigitalOcean, you can select a server with "pre-installed Docker". This will be the easiest option. Otherwise, you can install Docker CE by following this instruction:
https://docs.docker.com/engine/installation


#### D) Disable Firewall
Some server providers have strict firewall settings. To disable firewall on Ubuntu:
```bash
ufw disable
```

<br/>
<br/>

# Captain Setup


## Step 1: Captain Installation

Just run the following line, sit back and enjoy!
```bash
 mkdir /captain && docker run -p 80:80 -p 443:443 -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck
```

You will see a bunch of outputs on your screen. Once the Captain is initialized, you can visit `http://[IP_OF_YOUR_SERVER]:3000` in your browser and login to Captain using the default password `captain42`. You can change your password later. Do not make any changes in the dashboard. We'll use the command line tool to setup the server.

## Step 2: Connect Root Domain

Let's say you own `mydomain.com`. You can set `*.something.mydomain.com` as an `A-record` in your DNS settings to point to the IP address of the server where you installed Captain. Note that it can take several hours for this change to take into effect. It will show up like this in your DNS configs:
- **TYPE**: A record
- **HOST**: `*.something`
- **POINTS TO**: (IP Address of your server)
- **TTL**: (doesn't really matter)

To confirm, go to https://mxtoolbox.com/DNSLookup.aspx and enter `randomthing123.something.mydomain.com` and check if IP address resolves to the IP you set in your DNS. Note that `randomthing123` is needed because you set a wildcard entry in your DNS by setting `*.something` as your host, not `something`.

## Step 3: Install Captain CLI

Assuming you have npm installed, simply run (add `sudo` if needed):

```bash
 npm install -g captainduckduck
```

Then, run

```bash
 captainduckduck serversetup
```

Follow the steps and login to your captain instance. When prompted to enter the root domain, enter `something.mydomain.com` assuming that you set `*.something.mydomain.com` to point to your IP address in step #2. Now you can access your captain from `captain.something.mydomain.com`


## Step 4: Deploy the Test App

Go to the Captain in your browser, from the left menu select Apps and create a new app. Name it `my-first-app`. Then, download any of the test apps <a href="https://github.com/githubsaturn/captainduckduck/tree/master/captain-sample-apps">here</a>, unzip the content. and while inside the directory of the test app, run:

```bash
/home/Desktop/captain-examples/captain-node$  captainduckduck deploy
```
Follow the instructions, enter `my-first-app` when asked for app name. First time build takes about two minutes. After build is completed, visit `my-first-app.something.mydomain.com` where `something.mydomain.com` is your root domain. 
CONGRATS! Your app is live!!

You can connect multiple custom domains (like `www.my-app.com`) to a single app and enable HTTPS and do much more in the app's settings page.

Note that when you run `captainduckduck deploy`, the current git commit will be sent over to your server. **IMPORTANT:** uncommited files and files in `gitignore` WILL NOT get pushed to the server.

You can visit Captain in the browser and set custom parameters for your app such as environment variables, and do much more! For more details regarding deployment, please see CLI docs. For details on `captain-definition` file, see [Captain Definition File](captain-definition-file.md).
