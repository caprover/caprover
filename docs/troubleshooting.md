---
id: troubleshooting
title: Troubleshooting
sidebar_label: Troubleshooting
---

<br/>

This section covers most frequent issues that uses may encounter.

## Cannot connect <ip_server>:3000?
There is a whole set of reasons for this.

First you need to make sure that CaptainDuckDuck is running on your server. To check this, ssh to your server and run `docker service ps captain-captain --no-trunc`. You might see Captain is getting restarted constantly due to an error. Fix the issue and retry. See here for example: https://github.com/githubsaturn/captainduckduck/issues/14

Linode for example is notorious for [this kind of problem](https://github.com/docker/machine/issues/2753#issuecomment-171822791) and [this](https://github.com/docker/machine/issues/2753#issuecomment-188353704)

If you don't see any errors when your ran `docker service ps captain-captain --no-trunc`, then try `curl localhost:3000 -v`. If successful, it's probably your firewall that's blocking the connection. See [Firewall Docs](firewall.md).

## Successful Deploy but 502 bad gateway error!
This applies to you if:
- You have been able to setup your server and access it via `captain.rootdomain.example.com`.
- You have been able to deploy one of the samples apps (see [here](https://github.com/githubsaturn/captainduckduck/tree/master/captain-sample-apps)) successfully and it worked.
- You tried to deploy your own application and it deployed successfully, but when you try to access it via `yourappname.root.example.com` you get a 502 error.

If all above points are correct, this is how to troubleshoot:
- SSH to your server and view your application logs. Make sure it hasn't crashed and it's running. To view logs, please see the section at the end of this page "[How to view my application's log](#how-to-view-my-applications-log)"
- If you application logs show that your application is running, the most common case is that your application is binding to a custom port, not port 80. See here for [the fix](https://github.com/githubsaturn/captainduckduck/issues/130) .

## Want to customize a captain dashboard URL (or any other constants)
You can customize any constant defined in [CaptainConstants](https://github.com/githubsaturn/captainduckduck/blob/master/app-backend/src/utils/CaptainConstants.js) by adding a JSON file to `/captain/constants.conf`. For example, to change `defaultMaxLogSize`, the content of `/captain/constants.conf` will be:
```
{
 "defaultMaxLogSize":"128m"
}
```


## How to view my application's log?
Your application is deployed as a Docker service. For example, if your app name in captain is `my-app` you can view your logs by connecting to your server via SSH and run the following command:
```
docker service logs srv-captain--my-app --since 60m --follow
```

Note that Docker service name is prefixed with `srv-captain--`. Also, you can replace 60m with 10m to view last 10 minutes.

## How to restart my application?
If your application is not behaving well, you can try force restarting it by going to the web dashboard and select your app, then click on "Save Configuration & Update" button. It will forcefully restarts your application.

## How to restart CaptainDuckDuck
If your CaptainDuckDuck is not behaving well, you can try force restarting CaptainDuckDuck using:
```
docker service update captain-captain --force
```

Alternatively, you can go to CaptainDuckDuck dashboard, select your app, without changing anything, simply click on SAVE AND UPDATE CONFIGURATIONS button at the bottom of the page. This will force restart your app.

## How to stop and remove Captain?
Captain uses docker swarm to support clustering and restarting containers if they stop. That's why it keeps re-appearing. Try this:

`docker service rm $(docker service ls -q)`

then

`docker swarm leave --force`
