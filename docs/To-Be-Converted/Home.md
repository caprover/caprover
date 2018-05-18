### Easiest app/database deployment platform and webserver package for your NodeJS, Python, PHP, Ruby, Java applications. No Docker, nginx knowledge required!

[![YouTube](https://raw.githubusercontent.com/githubsaturn/captainduckduck/master/graphics/screenshots.gif)](https://www.youtube.com/watch?v=XDrTmGSDW3s)

## Captain Design Principle
CaptainDuckDuck is designed to help you setup a server(/s) with Docker swarm, nginx, Let's Encrypt in a matter of few minutes. It is lightweight and so non-intrusive that after you deploy your apps, you can completely remove CaptainDuckDuck from your servers and your users won't even notice anything.

In other words, CaptainDuckDuck is just a deployment helper. It either exposes a property used by its backing structure (nginx and Docker), or allows you to manually customize it. For example, environmental variables for your app can be set using CaptainDuckDuck dashboard. But CPU/RAM limits for your apps are currently not supported via CaptainDuckDuck. You can manually change these values using plain Docker commands and CaptainDuckDuck respects your change and does not modify it at all. Read more about it [here](https://docs.docker.com/engine/reference/commandline/service_update/#options).

Similarly, you can modify nginx detailed configs, read [here](https://github.com/githubsaturn/captainduckduck/wiki/NGINX-Customization).


## Captain Workflow in One Picture

<p>
    <img alt="CaptainDuckDuck" src="https://raw.githubusercontent.com/githubsaturn/captainduckduck/master/graphics/captain-in-one-picture.png" width="450"/>
</p>



## Captain Architecture in One Picture

<p>
    <img alt="CaptainDuckDuck" src="https://raw.githubusercontent.com/githubsaturn/captainduckduck/master/graphics/captain-architecture.png" width="450"/>
</p>

