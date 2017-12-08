### Easiest app deployment platform and webserver package for your NodeJS, Python, Java applications. No Docker, nginx knowledge required!

[![YouTube](https://raw.githubusercontent.com/githubsaturn/captainduckduck/master/screenshots.gif)](https://www.youtube.com/watch?v=576RsaocNUE)

### Seriously! Who should care about CaptainDuckDuck?
- A [web] developer who does not like spending hours and days setting up a server, build tools, sending code to server, build it, get an SSL certificate, install it, update nginx over and over again.
- A developer who uses expensive services like Heroku, Microsoft Azure and etc. And is interested in reducing their cost by 400% (Heroku charges 25$/month for their 1gb instance, the same server is 5$ on vultr!!)
- Someone who prefers to write more of `showResults(getUserList())` and not much of `$ apt-get install libstdc++6 > /dev/null`
- Someone who likes installing MySQL, MongoDB and etc on their server by selecting from a dropdown and clicking on install!
- How much server/docker/linux knowledge is required to set up a CaptainDuckDuck server? Answer: Knowledge of Copy & Paste!! Head over to "Getting Started" for information on what to copy & paste ;-)

### You code your app, Captain does the rest!

Captain is a modern automated app deployment & web server manager. It's blazingly fast and very robust as it uses Docker, nginx, LetsEncrypt, NetData. 

  - Deploy apps in your own space (Node js, PHP, Python, literally any language!)
  - Deploying built-in apps is a matter of seconds! MongoDB, Parse, MySQL, WordPress, Postgres and many more.
  - Secure your services over HTTPS for FREE
  - Attach more nodes and create a cluster in seconds! Captain automatically configures nginx to load balance.
  - Focus on your apps! Not the bells and whistles just to run your apps!

<p>
    <img alt="CaptainDuckDuck" src="https://raw.githubusercontent.com/githubsaturn/captainduckduck/master/diagram.png" width="450"/>
</p>

## Getting started!

### Step 0: Prerequisites

#### A) Domain Name

During installation, you'll be asked to point a wildcard DNS entry to your Captain IP Address. If you need help with domain name, see <a href="#setup-domain-and-dns">Domain and DNS</a>. This will cost you as low as $2 a year.

#### B) Server with a Public IP

Captain has to be installed on a machine with a public IP address. If you need help with Public IP, see <a href="#server--public-ip-address">Server & Public IP address</a>. This will cost you as low as $5 a month. If you use the DigitalOcean referral code, you'll get $10 credit - two months worth of free server: https://m.do.co/c/6410aa23d3f3 

Note that you can install Captain on your laptop which is behind NAT (your router) for testing purposes, but it requires some special setup, like port forwarding.

#### C) Install Docker on Server (at least, version 17.06.x)

If you get your server from DigitalOcean, you can select a server with "pre-installed Docker". This will be the easiest option. Otherwise, you can install Docker CE by following this instruction:
https://docs.docker.com/engine/installation


### Step 1: Captain Installation

Just run the following line, sit back and enjoy!
```bash
 mkdir /captain && docker run -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck
```

You will see a bunch of outputs on your screen. Once the Captain is initialized, you can visit `http://[IP_OF_YOUR_SERVER]:3000` in your browser and login to Captain using the default password `captain42`. You can change your password in settings.

### Step 2: Connect Root Domain

Let's say you own `mydomain.com`. You can set `*.something.mydomain.com` as an `A-record` in your DNS settings to point to the IP address of the server where you installed Captain. If you need help with this, see <a href="#setup-domain-and-dns">Domain and DNS</a>. Note that it can take several hours for this change to take into effect. It will show up like this in your DNS configs:
- **TYPE**: A record
- **HOST**: `*.something`
- **POINTS TO**: (IP Address of your server)
- **TTL**: (doesn't really matter)

Next, go to `http://[IP_OF_YOUR_SERVER]:3000` in your browser, and enter `something.mydomain.com` as your root and click on "update root domain" assuming you have already set `*.something.mydomain.com` to point to your server's IP address in your DNS configs. One you click on update, you should see a success message and you can access your captain from `captain.something.mydomain.com` instead of `http://[IP_OF_YOUR_SERVER]:3000`.

### Step 3: Install Captain CLI

Assuming you have npm installed, simply run (add `sudo` if needed):

```bash
 npm install -g captainduckduck
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

For more details regarding deployment, please see CLI docs. For details on `captain-definition` file, see Captain Definition File section below.


## Do Much More:

### Enable HTTPS on Captain:

One of the benefits of Captain, is the ONE CLICK HTTPS activation. Simply click on Enable HTTPs on your dashboard and after a couple of seconds your HTTPS is enabled. Note that once HTTPS is enabled, you cannot change your root domain, i.e. `something.mydomain.com`, of course it's always possible to re-install Captain and change it. After enabling HTTPS, you can optionally, although very recommended, enforce HTTPS for all requests, i.e. denying plain insecure HTTP connections and redirect them to HTTPS. Make sure you manually check HTTPS before doing this. Simply go to `https://captain.something.mydomain.com` and if it works, you can safely force HTTPS.

### Enable HTTPS for Apps:

You have full control over enabling HTTPS on your own apps. Once Captain root HTTPS is enabled, you can enable HTTPS for individual apps. To do so, simply go to Captain web, select Apps from the left side menu, scroll to your desired app, and click on Enable HTTPS. That's it!

### Connect Custom Domains to Apps:

Let's say, your `pizza.something.yourdomain.com` is very popular and you want to take the next step and make it available on `www.pizza.com`. First you buy the domain! Next, similar to Captain setup, you go to your DNS settings and point `www` host to your Captain IP address. Alternatively, you can point `*` to Captain IP address. After doing this, go to Apps section, and enter `www.pizza.com` as custom domain and click on connect! Done!


### Captain Definition File

One of the key components of CaptainDuckDuck is the `captain-definition` file that sits at the root of your project. In case of NodeJS app, it sits next package.json, or next to index.php in case of PHP, or requirements.txt for Python app. It's a simple JSON like below:


```
 {
  "schemaVersion" :1 ,
  "templateId" :"node/8.7.0"
 }
```

schemaVersion is always 1. And templateId is the piece which defines the what sort of base you need in order to run your app. It is in LANGUAGE/VERSION format. LANGUAGE can be one of these: `node`, `php`, `python`. See supported versions below for the versions.

Note that although the current version of CaptainDuckDuck comes with 3 most popular web app languages: NodeJS, PHP and Python (Django). It gives you the advanced option of defining your own Dockerfile. For example, the two captain-definition files below generate the exact same result.

Simple version

```
 {
  "schemaVersion" :1 ,
  "templateId" :"node/8.7.0"
 }
```


Advanced Version

```
 {
  "schemaVersion" :1 ,
  "dockerfileLines" :[
                        "FROM node:8.7.0-alpine",
                        "RUN mkdir -p /usr/src/app",
                        "WORKDIR /usr/src/app",
                        "COPY ./src/package.json /usr/src/app/",
                        "RUN npm install && npm cache clean --force",
                        "COPY ./src /usr/src/app",
                        "ENV NODE_ENV production",
                        "ENV PORT 80",
                        "EXPOSE 80",
                        "CMD [ \"npm\", \"start\" ]"
                    ]
 }
```

Even if you don't know anything about Docker, you can get an idea what this does.

**IMPORANT NOTE:** Captain generates a dockerfile and puts it besides a directory named `src` where your source code sits. So if in your normal dockerfile, you have `COPY ./somefile /usr/app`, you will have to change it to `COPY ./src/somefile /usr/app` otherwise deploy would fail.

Using this approach you can deploy Ruby, Java, Scala, literally everything! As Captain becomes more mature, more and more languages will be added to the built-in template, so you don't have to create the dockerfile manually like above. If you need more details on dockerfile, please see:

https://docs.docker.com/engine/reference/builder/
and
https://docs.docker.com/engine/userguide/eng-image/dockerfile_best-practices/


#### Supported version tags for built-in languages:

node/
`argon`, `boron`, `carbon`, `4`, `4.6`, `4.6.2`, `4.7`, `4.7.0`, `4.7.1`, `4.7.2`, `4.7.3`, `4.8`, `4.8.0`, `4.8.1`, `4.8.2`, `4.8.3`, `4.8.4`, `4.8.5`, `6`, `6.10`, `6.10.0`, `6.10.1`, `6.10.2`, `6.10.3`, `6.11`, `6.11.0`, `6.11.1`, `6.11.2`, `6.11.3`, `6.11.4`, `6.11.5`, `6.9`, `6.9.1`, `6.9.2`, `6.9.3`, `6.9.4`, `6.9.5`, `7`, `7.1`, `7.1.0`, `7.10`, `7.10.0`, `7.10.1`, `7.2`, `7.2.0`, `7.2.1`, `7.3`, `7.3.0`, `7.4`, `7.4.0`, `7.5`, `7.5.0`, `7.6`, `7.6.0`, `7.7`, `7.7.0`, `7.7.1`, `7.7.2`, `7.7.3`, `7.7.4`, `7.8`, `7.8.0`, `7.9`, `7.9.0`, `8`, `8.0`, `8.0.0`, `8.1`, `8.1.0`, `8.1.1`, `8.1.2`, `8.1.3`, `8.1.4`, `8.2`, `8.2.0`, `8.2.1`, `8.3`, `8.3.0`, `8.4`, `8.4.0`, `8.5`, `8.5.0`, `8.6`, `8.6.0`, `8.7`, `8.7.0`, `8.8`, `8.8.0`, `8.8.1`, `8.9`, `8.9.0`, `9`, `9.0`, `9.0.0`

php/
`rc`, `5`, `5.3`, `5.3.29`, `5.4`, `5.4.32`, `5.4.33`, `5.4.34`, `5.4.35`, `5.4.36`, `5.4.37`, `5.4.38`, `5.4.39`, `5.4.40`, `5.4.41`, `5.4.42`, `5.4.43`, `5.4.44`, `5.4.45`, `5.5`, `5.5.16`, `5.5.17`, `5.5.18`, `5.5.19`, `5.5.20`, `5.5.21`, `5.5.22`, `5.5.23`, `5.5.24`,
`5.5.2`, `5.5.26`, `5.5.27`, `5.5.28`, `5.5.29`, `5.5.30`, `5.5.31`, `5.5.32`, `5.5.33`, `5.5.34`, `5.5.35`, `5.5.36`, `5.5.37`, `5.5.38`, `5.6`, `5.6.0`, `5.6.1`, `5.6.10`, `5.6.11`, `5.6.12`, `5.6.13`, `5.6.14`, `5.6.15`, `5.6.16`, `5.6.17`, `5.6.18`, `5.6.19`, `5.6.2`, `5.6.20`, `5.6.21`, `5.6.22`, `5.6.23`, `5.6.24`, `5.6.25`, `5.6.26`, `5.6.27`, `5.6.28`, `5.6.29`, `5.6.3`, `5.6.30`, `5.6.31`, `5.6.32`, `5.6.4`, `5.6.5`, `5.6.6`, `5.6.7`, `5.6.8`, `5.6.9`, `7`, `7.0`, `7.0.0`, `7.0.0beta1`, `7.0.0beta2`, `7.0.0beta3`, `7.0.0RC1`, `7.0.0RC2`, `7.0.0RC3`, `7.0.0RC4`, `7.0.0RC5`, `7.0.0RC6`, `7.0.0RC7`, `7.0.0RC8`, `7.0.1`, `7.0.10`, `7.0.11`, `7.0.12`, `7.0.13`, `7.0.14`, `7.0.15`, `7.0.16`, `7.0.17`, `7.0.18`, `7.0.19`, `7.0.2`, `7.0.20`, `7.0.21`, `7.0.22`, `7.0.23`, `7.0.24`, `7.0.25`, `7.0.3`, `7.0.4`, `7.0.5`, `7.0.6`, `7.0.7`, `7.0.8`, `7.0.9`, `7.1-rc`, `7.1`, `7.1.0`, `7.1.0RC1`, `7.1.0RC2`, `7.1.0RC3`, `7.1.0RC4`, `7.1.0RC5`, `7.1.0RC6`, `7.1.1`, `7.1.10`, `7.1.11`, `7.1.2`, `7.1.3`, `7.1.4`, `7.1.5`, `7.1.6`, `7.1.7`, `7.1.8`, `7.1.9`, `7.2-rc`, `7.2.0alpha3`, `7.2.0beta1`, `7.2.0beta2`, `7.2.0beta3`, `7.2.0RC1`, `7.2.0RC2`, `7.2.0RC3`, `7.2.0RC4`, `7.2.0RC5`

python/
`rc`, `2.7.13`, `2.7.14`, `2.7`, `2`, `3.6-rc`, `3.6.1`, `3.6.2`, `3.6.2rc1` `3.6.2rc2`, `3.6.3`, `3.6`, `3.7-rc`, `3.7.0a1`, `3.7.0a2`, `3`


### Run Multiple Instances of App:

Your Pizza app is doing great and you are getting thousands of hits on your website. Having one instance of your app is not good enough. Your latency has gone up. Next thing you want is to consider to run multiple instances of your app on your Captain. You can do this from the Apps section of Captain web. Let's say you change your instance count to 3. Captain creates 3 instances of your app running at the same time. If any of them dies (crashes), it automatically spins off a new one! You always have 3 instances of your Pizza app running! The best part? Captain automatically spreads the requests between different instances of your app. 

### Run Multiple Servers:

Wow! Your Pizza app is really popular! You have 3 instances of your app running on the same server, RAM and CPU are almost maxed out. You need to get a second server. How do you connect the servers? Captain does that for you ;-) You simply get a server with Docker installed on it, similar to what you did for the original Captain server.

At this point, you have IP address of your new server, IP address of your main Captain node, username of your remote server (root is required for Docker use), private SSH key. Now, go to the "Nodes" section of Captain, enter the values and click on Join Cluster. Done! You now have a real cluster of your own! You can now change the instance count to 6, and Captain will spin up some instances on the other server for you, also automatically load balances the request and creates new instances if one machine dies.

Note on worker / manager nodes. Rule of thumb is you keep your manager count as an odd number:
- 2 machines: main machine manager, the other machine worker
- 3 machines: either one manager, two workers, or 3 managers
- 4 machines: either one manager, two workers, or 3 managers and one worker

For more details, see this link:
https://docs.docker.com/engine/swarm/how-swarm-mode-works/nodes/

Note: for cluster mode you will need to setup a Docker Registry.


### Setup Docker Registry:

Docker Registry is simply the repository that different nodes in a cluster can access to download your app and run it. If you are not running your instance on a cluster, there is pretty much no benefit to setting up Docker Registry.

On the other hand, Docker Registry is necessary for clusters. To setup Registry, simply go to your Captain web dashboard and follow the instructions. You will be given two options:
- Docker Registry managed by Captain.
- Docker Registry managed by a 3rd party provider.

For most cases, a Registry managed by Captain should be good enough. Note that before switching to cluster from a single node, if you have any existing app, you will have to setup Registry and re-deploy all your existing app to make sure they are pushed to the registry and are available to all nodes, not just the main leader node.



### Resource Consumption of Server:

You want to see how your app is behaving. Is it eating up your memory or CPU? Or is your network connection slow? You can answer all these questions by visiting Captain Monitoring menu from the web dashboard. You can enable NetData which is a server monitoring tool and monitor your server. 




## Need More Help?

### Cannot connect <ip_server>:3000?
There is a whole set of reasons for this. First you need to make sure that CaptainDuckDuck is running on your server. To check this, ssh to your server and run `docker service ps captain-captain --no-trunc`. You might see Captain is getting restarted constantly due to an error. Fix the issue and retry. See here for example: https://github.com/githubsaturn/captainduckduck/issues/14

If you don't see any errors, then try `curl localhost:3000 -v`. If successful, it's probably your firewall that's blocking the connection. See firewall section below.

### How to stop and remove Captain?
See here: https://github.com/githubsaturn/captainduckduck/issues/12

### Firewall & Port Forwarding

Captain uses:
- 7946 TCP/UDP for Container Network Discovery
- 4789 TCP/UDP for Container Overlay Network
- 2377 TCP/UDP for Docker swarm API
- 3000 TCP for initial Captain Installation (can be blocked once Captain is attached to a domain)
- 80   TCP for regular HTTP connections
- 443  TCP for secure HTTPS connections
- 996  TCP for secure HTTPS connections specific to Docker Registry

Or simply disable firewall entirely. In case of an ubuntu server, run `ufw disable`.


### Setup Domain and DNS

To do this, you need to login to the domain provider which you used to purchase your `mydomain.com` domain. You can use GoDaddy.com or NameCheap.com. If you are first time buyer with GoDaddy, just google for GoDaddy 99 cent domains. You'll find coupons that offer 1-year lease for dot com domains for 99 cents! 

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

DigitalOcean calls their servers "Droplets". After signing up, go to the Droplets section and click on "Create Droplet". Under choose an image, click on One-Click Apps, and select Docker. This way, Docker comes pre-installed with your server. If you have an SSH key, enter your SSH key at the bottom of this Droplet Create page, if not, don't worry, it's just alternative password. Once your Droplet is created, you will get an email with IP address of your server, user and pass. If you know how to SSH, then great, SSH into your server. If not, again don't worry! DigitalOcean is really beginner friendly. Simply go to your Droplets section on your DigitalOcean account, click on the Droplet you created. From the menu on the left side, select ACCESS and launch console. Enter `root` when asked for login and enter the password which you received in email. If you didn't receive your password in email, click on Reset Root Password below Launch Console button. Note that you'll have to type your long password. The web interface that DigitalOcean gives you does not support Copy/Paste ctrl+c ctrl+v.

At this point you are logged into your server and you can run:

```bash
docker run -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck
```

> Icon made by Freepik from www.flaticon.com
