### Easiest app/database deployment platform and webserver package for your NodeJS, Python, Java applications. No Docker, nginx knowledge required!

[![YouTube](https://raw.githubusercontent.com/githubsaturn/captainduckduck/master/graphics/screenshots.gif)](https://www.youtube.com/watch?v=576RsaocNUE)

Tutorial for version 0.2:
https://www.youtube.com/watch?v=XDrTmGSDW3s

### Seriously! Who should care about CaptainDuckDuck?
- A [web] developer who does not like spending hours and days setting up a server, build tools, sending code to server, build it, get an SSL certificate, install it, update nginx over and over again.
- A developer who uses expensive services like Heroku, Microsoft Azure and etc. And is interested in reducing their cost by 4x (Heroku charges 25$/month for their 1gb instance, the same server is 5$ on vultr!!)
- Someone who prefers to write more of `showResults(getUserList())` and not much of `$ apt-get install libstdc++6 > /dev/null`
- Someone who likes installing MySQL, MongoDB and etc on their server by selecting from a dropdown and clicking on install!
- How much server/docker/linux knowledge is required to set up a CaptainDuckDuck server? Answer: Knowledge of Copy & Paste!! Head over to "Getting Started" for information on what to copy & paste ;-)

### You code your app, Captain does the rest!

Captain is a modern automated app deployment & web server manager. It's blazingly fast and very robust as it uses Docker, nginx, LetsEncrypt, NetData. 

  - Deploy apps in your own space (Node js, PHP, Python, literally any language!)
  - Deploying one-click apps is a matter of seconds! MongoDB, Parse, MySQL, WordPress, Postgres and many more.
  - Ability to secure your services over HTTPS for FREE, ability to automatically redirect HTTP to HTTPS.
  - Many ways to deploy: upload your source from dashboard, use command line `captainduckduck deploy`, use github, bitbucket, gitlab and other webhooks to automatically trigger a build upon `git push`
  - Attach more nodes and create a cluster in seconds! Captain automatically configures nginx to load balance.
  - Simple interface for many docker operations: exposing container ports to host, setting up persistent directories, instance count and etc.
  - Optionally fully customizable nginx config allowing you to enable HTTP2, specific caching logic, custom SSL certs and etc.
  - Focus on your apps! Not the bells and whistles just to run your apps!

## Getting Started!

For a detailed tutorial, please see
https://github.com/githubsaturn/captainduckduck/wiki/Getting-Started

## Captain Workflow in One Picture

<p>
    <img alt="CaptainDuckDuck" src="https://raw.githubusercontent.com/githubsaturn/captainduckduck/master/graphics/captain-in-one-picture.png" width="450"/>
</p>



## Captain Architecture in One Picture

<p>
    <img alt="CaptainDuckDuck" src="https://raw.githubusercontent.com/githubsaturn/captainduckduck/master/graphics/captain-architecture.png" width="450"/>
</p>



> Icon made by Freepik from www.flaticon.com
