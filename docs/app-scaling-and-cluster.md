---
id: app-scaling-and-cluster
title: App Scaling & Cluster
sidebar_label: App Scaling & Cluster
---

<br/>

Captain offers you multiple ways to scale up your app, running it on multiple processes and benefit from all resources on your server.

## Run Multiple Instances of App:

Your Pizza app is doing great and you are getting thousands of hits on your website. Having one instance of your app is not good enough. Your latency has gone up. Next thing you want is to consider to run multiple instances of your app on your Captain. You can do this from the Apps section of Captain web. Let's say you change your instance count to 3. Captain creates 3 instances of your app running at the same time. If any of them dies (crashes), it automatically spins off a new one! You always have 3 instances of your Pizza app running! The best part? Captain automatically spreads the requests between different instances of your app. 

## Run Multiple Servers:

Wow! Your Pizza app is really popular! You have 3 instances of your app running on the same server, RAM and CPU are almost maxed out. You need to get a second server. How do you connect the servers? Captain does that for you ;-) You simply get a server with Docker installed on it, similar to what you did for the original Captain server.

At this point, you have to enter the following information:
- Captain IP Address (as seen by remote): this is the IP address of your first server
- Remote IP Address (as seen by Captain): this is the IP address of your second server
- Remote Username: Note that unless you have a custom setup, this should be `root`
- Private SSH key: this is the SSH key that you use to SSH to your second server. On Linux, it's on `/home/yourusername/.ssh/id_rsa`
- Node type: this describes what the role of the new server is. Use `worker` if you're new to Docker, for more details, read https://docs.docker.com/engine/swarm/how-swarm-mode-works/nodes/

 IP address of your new server, IP address of your main Captain node, username of your remote server (root is required for Docker use), private SSH key. Now, go to the "Nodes" section of Captain, enter the values and click on Join Cluster. Done! You now have a real cluster of your own! You can now change the instance count to 6, and Captain will spin up some instances on the other server for you, also automatically load balances the request and creates new instances if one machine dies.

The leader node is a manager who's been elected as Leader. This is the node where Captain and main services such as nginx and Certbot (Let's Encrypt) will be running on. All your apps automatically get distributed to nodes by docker swarm.



Note: for cluster mode you will need to setup a Docker Registry.


### Setup Docker Registry:

Docker Registry is simply the repository that different nodes in a cluster can access to download your app and run it. If you are not running your instance on a cluster, there is pretty much no benefit to setting up Docker Registry.

On the other hand, Docker Registry is necessary for clusters. To setup Registry, simply go to your Captain web dashboard and follow the instructions. You will be given two options:
- Docker Registry managed by Captain.
- Docker Registry managed by a 3rd party provider.

For most cases, a Registry managed by Captain should be good enough. Note that before switching to cluster from a single node, if you have any existing app, you will have to setup Registry and re-deploy all your existing app to make sure they are pushed to the registry and are available to all nodes, not just the main leader node.

