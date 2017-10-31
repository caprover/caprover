### An nginx & Docker marriage made in heaven.
<p align="center">
    <img alt="CaptainDuckDuck" src="https://raw.githubusercontent.com/githubsaturn/captainduckduck/master/screenshots.gif" width="400"/>
</p>

[![YouTube](https://raw.githubusercontent.com/githubsaturn/captainduckduck/master/youtube-snapshot.png)](https://www.youtube.com/watch?v=576RsaocNUE)


# CaptainDuckDuck

## It uses Docker+nginx+LetsEncrypt+NetData

Captain is a modern automated app deployment & web server manager.

  - Deploy apps in your own space (Node js, PHP, Python, literally any language!)
  - Secure your services over HTTPS for FREE
  - Scale in seconds
  - Focus on your apps! Not the bells and whistles just to run your apps!


## Getting started!

### Step 0: Prerequisites

#### A) Domain Name

During installation, you'll be asked to point a wildcard DNS entry to your Captain IP Address. If you need help with domain name, see <a href="#setup-domain-and-dns">Domain and DNS</a>. This will cost you as low as $2 a year.

#### B) Server with a Public IP

Captain has to be installed on a machine with a public IP address. If you need help with Public IP, see <a href="#server--public-ip-address">Server & Public IP address</a>. This will cost you as low as $5 a month. If you use the DigitalOcean referral code, you'll get $10 credit - two months worth of free server: https://m.do.co/c/6410aa23d3f3 

Note that you can install Captain on your laptop which behind NAT (your router) for testing, but it requires some special setup, like port forwarding.

#### C) Install Docker on Server (at least, version 17.06.x)

If you get your server from DigitalOcean, you can select a server with "pre-installed Docker". This will be the easiest option. Otherwise, you can install Docker CE by following this instruction:
https://docs.docker.com/engine/installation


### Step 1: Captain Installation

Just run the following line, sit back and enjoy!
```bash
 mkdir /captain && docker run -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck
```

You will see a bunch of output on your screen. Once the Captain is initialized, you can visit `http://[IP_OF_YOUR_SERVER]:3000` in your browser and login to Captain using the default password `captain42`. You can change your password in settings.

### Step 2: Connect Root Domain

Let's say you own `mydomain.com`. You can set `*.something.mydomain.com` as an `A-record` in your DNS settings to point to the IP address of the server where you installed Captain. If you need help with this, see <a href="#setup-domain-and-dns">Domain and DNS</a>. Note that it can take several hours for this change to take into effect. Go to `http://[IP_OF_YOUR_SERVER]:3000` in your browser, and enter `something.mydomain.com` as your root, and click update. If DNS changes are succesful, you will get a success message and you can access your captain from `captain.something.mydomain.com` instead of `http://[IP_OF_YOUR_SERVER]:3000`.

### Step 3: Install Captain CLI

Assuming you have npm installed. Simply run (add `sudo` if needed):
```bash
 npm install -g npm captainduckduck
```

Then, run `captainduckduck login`, follow the steps and login to your captain instance.


### Step 4: Deploy the Test App

Go to the Captain in your browser, from the left menu select Apps and create a new app. Name it `my-first-app`. Then, download any of the test apps <a href="https://github.com/githubsaturn/captainduckduck/tree/master/captain-sample-apps">here</a>, unzip the content. and while inside the directory of the test app, run:

```bash
/home/Desktop/captain-examples/captain-node$  captainduckduck deploy
```
Follow the instructions, enter `my-first-app` when asked for app name. First time build takes about two minutes. After build is completed, visit `my-first-app.something.mydomain.com` where `something.mydomain.com` is your root domain. 
CONGRATS! Your app is live!!

You can visit Captain in the browser and set custom parameters for your app such as environment variables, and do much more!

For more details regarding deployment, mainly `captain-definition` file, please see CLI docs.


## Do Much More:

### Enable HTTPS on Captain:

One of a benefits of Captain, is ONE CLICK HTTPS activation. Simply click on Enable HTTPs on your dashboard and after a coupld of seconds your HTTPS is enabled. Note that once HTTPS is enabled, you cannot change your root domain, i.e. `something.mydomain.com`, of course it's always possible to re-install Captain and change it. After enabling HTTPS, you can optionally, although very recommented, enforce HTTPS for all connections, i.e. denying plain insecure HTTP connections and redirect them to HTTPS. Make sure you manually check HTTPS before doing this. Simply go to `https://captain.something.mydomain.com` and if it works, you can safely force HTTPS.

### Enable HTTPS for Apps:

You have full control over enabling HTTPS on your own apps. Once Captain root HTTPS is enabled, you can enable HTTPS for individual apps. To do so, simply go to Captain web, select Apps from the left side menu, scroll to your desired app, and click on Enable HTTPS. That's it!

### Connect Custom Domains to Apps:

Let's say, your `pizza.something.yourdomain.com` is very popular and you want to take the next step and make it available on `www.pizza.com`. First you buy the domain! Next, similar to Captain setup, you go to your DNS settings and point `www` host to your Captain IP address. Alternatively, you can point `*` to Captain IP address. After doing this, go to Apps section, and enter `www.pizza.com` as custom domain and click on connect! Done!

### Run Multiple Instances of App:

Your Pizza app is doing great and you are getting thousands of hits on your website. Having once instance of your app is not good enough. Your latency has gone up. Next thing you want to consider to run multiple instances of your app on your Captain. You can do this from the Apps section of Captain web. Let's say you change your instance count to 3. Captain creates 3 instances of your app running at the same time. If any of them dies (crashes), it automatically spins off a new one! You always have 3 instances of your Pizza app running! The best part? Captain automatically spreads the requests between different instances of your app. 

### Run Multiple Servers:

Wow! Your Pizza app is really popular! You have 3 instances of your app running on the same server, RAM and CPU are almost maxed out. You need a get a second server. How do you connect the servers? Captain does that for you ;-) You simply get a server with Docker installed on it, similar to what you did for the original Captain server.

At this point, you have IP address of your new server, IP address of your main Captain node, username of your remote server (root is required for Docker use), private SSH key. Now, go to the "Nodes" section of Captain, enter the values and click on Join Cluster. Done! You now have a real cluster of your own! You can now change the instance count to 6, and Captain will new up some instances on the other server for you, automatically load balances the request and create new instances if one machine dies.

Note on worker / manager nodes. Rule of thumb is you keep your manager count as an odd number:
- 2 machines: main machine manager, the other machine worker
- 3 machines: either one manager, two workers, or 3 managers
- 4 machines: either one manager, two workers, or 3 managers and one worker

For more details, see this link:
https://docs.docker.com/engine/swarm/how-swarm-mode-works/nodes/

Note: for cluster mode you will need to setup a Docker Registry.


### Setup Docker Registery:

Docker Registry is simply the repository that different nodes in a cluster can access to download your app and run it. If you are not running your instance on a cluster, there is pretty much no benefit to setting up Docker Registry.

On the other hand, Docker Registry is necessary for clusters. To setup Registry, simply go to your Captain web dashboard and follow the instructions. You will be given two options:
- Docker Registry managed by Captain.
- Docker Registry managed by a 3rd party provider.

For most cases, a Registry managed by Captain should be good enough. Note that before switching to cluster from a single node, if you have any existing app, you will have to setup Registry and re-deploy all your existing app to make sure they are pushed to the registry and are available to all nodes, not just the main leader node.



### Resource Consumption of Server:

You want to see how your app is behaving. Is it eating up your memory or CPU? Or is your network connection slow? You can answer all these questions by visiting Captain Monitoring menu from the web dashboard. You can enable NetData which is a server monitoring tool and monitor your server. 




## Need More Help?

### Firewall & Port Forwarding

Captain uses:
7946 TCP/UDP for Container Network Discovery
4789 TCP/UDP for Container Overlay Network
2377 TCP/UDP for Docker swarm API
3000 TCP for initial Captain Installation (can be blocked once Captain is attached to a domain)
80   TCP for regular HTTP connectiosn
443  TCP for secure HTTPS connections
996  TCP for secure HTTPS connections specific to Docker Registry



### Setup Domain and DNS

To do this, you need to login to the domain provider which you used to purchase your `mydomain.com` domain. You can use GoDaddy.com or NameCheap.com. If you are first time buyer with GoDaddy, just google for GoDaddy 99 cent domains. You'll find copouns that offer 1-year leas for dot com domains for 99 cents! 

After you purchased your domain, look for DNS settings under your domain settings. You should see a table of some sort with various entries. Look for an ADD button. Then fill the entries:

- Type: A / A-Record
- Host: `*.something` Replace with `*.anything-you-want`
- Points To: `199.199.199.199` Replace with your server's IP
- TTL: Pick the smallest TTL available, typically 30 minutes.

This process takes minutes, sometimes hours to take into effect.

To confirm, you can use a DNS lookup tool, like: https://mxtoolbox.com/DNSLookup.aspx
Enter `some-random-word.something.mydomain.com` and check to see if the IP is correct.

### Server & Public IP address

If this is your first time setting up a server, DigitalOcean is probably the easiest solution for you. Plus, you can use this link and get $10 credit!
https://m.do.co/c/6410aa23d3f3

DigitalOcean calls their servers "Droplets". After signing up, go to the Droplets section and click on "Create Droplet". Under choose an image, click on One-Click Apps, and select Docker. This way, Docker comes pre-installed with your server. If you have an SSH key, enter your SSH key at the bottom of this Droplet Create page, if not, don't worry, it's just alternative password. Once your Droplet is created, you will get an email with IP address of your server, user and pass. If you know how to SSH, then great, SSH into your server. If not, again don't worry! DigitalOcean is really beginner friendly. Simply go to your Droplets section on your DigitalOcean account, click on the Droplet you created. From the menu on the left side, select ACCESS and lauch console. Enter `root` when asked for login and enter the password which you received in email. If you didn't receive your password in email, click on Reset Root Password below Launch Console button. Note that you'll have to type your long password. The web interface that DigitalOcean gives you does not support Copy/Paste ctrl+c ctrl+v.

At this point you are logged into your server and you can run:

```bash
docker run -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck
```


> Icon made by Freepik from www.flaticon.com
