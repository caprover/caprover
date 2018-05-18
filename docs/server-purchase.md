---
id: server-purchase
title: Server & Public IP address
sidebar_label: Server Purchase
---


If this is your first time setting up a server, DigitalOcean is probably the easiest solution for you. Plus, you can use this link and get $10 credit!
https://m.do.co/c/6410aa23d3f3

DigitalOcean calls their servers "Droplets". After signing up, go to the Droplets section and click on "Create Droplet". Under choose an image, click on One-Click Apps, and select Docker. This way, Docker comes pre-installed with your server. If you have an SSH key, enter your SSH key at the bottom of this Droplet Create page, if not, don't worry, it's just alternative password. Once your Droplet is created, you will get an email with IP address of your server, user and pass. If you know how to SSH, then great, SSH into your server. If not, again don't worry! DigitalOcean is really beginner friendly. Simply go to your Droplets section on your DigitalOcean account, click on the Droplet you created. From the menu on the left side, select ACCESS and launch console. Enter `root` when asked for login and enter the password which you received in email. If you didn't receive your password in email, click on Reset Root Password below Launch Console button. Note that you'll have to type your long password. The web interface that DigitalOcean gives you does not support Copy/Paste ctrl+c ctrl+v.

At this point you are logged into your server and you can run captain installer: `docker run -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck`
