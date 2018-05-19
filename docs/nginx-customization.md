---
id: nginx-customization
title: NGINX Config
sidebar_label: NGINX Config
---

## Config Customization
Although CaptainDuckDuck automatically manages everything about routing HTTP requests to your apps, there might still be some special config values that you want to manually tweak. It can be special caching logic for special file type or route, timeout customization, max body size and many more parameters that you can manually adjust via nginx.

CaptianDuckDuck enables you to manually adjust these parameters via fully customized config files. There are three areas that you can adjust parameters:
- NGINX Base Config File (`/etc/nginx/nginx.conf`). This is the first file that NGINX will look at. It redirects nginx to look up other config files. You can manually tweak this file in web dashboard, settings.
- CaptainDuckDuck Config File (`/etc/nginx/conf.d/captain-root.conf`). This is the config file that you, the developer, will interact with when you visit `captain.root.domain.com`. Typically, you shouldn't need to modify this file. But if you need to, you can modify it in web dashboard > settings
- Application Specific Config File (`/etc/nginx/conf.d/captain.conf`). This is where you can change application-specific settings. Let's say, you have a video uploader app where you want to allow incoming body size to be 1GB. You can do so, by going to web dashboard > Apps > Apps Edit and manually change this parameter. Note that any change that you make is only applied to this specific app, all other apps will use the default config. This configuration template will be applied to ALL DOMAINS pointing to the app, i.e., Captain creates one server block for `my-app-name.captainroot.domain.com` and potentially another server block `www.myapp.com` and etc... 

Once you've changed the template, you can see the compiled version of your nginx configs at `/captain/generated/nginx` in order to verify whether the final compiled version is what you wanted. Note that you CANNOT MANUALLY modify these files as they will get overridden by Captain. If you want to make any change, you should always change the Nginx template in CaptainDuckDuck dashboard.


## Custom Files and Directories
On top of config customization, you might need to use some files in your nginx container, things such as custom SSL certs, specific static assets and etc. Since in CaptainDuckDuck instance, everything (including nginx) is sitting in a separate container, you'll need to map a directory from your host to the container. Captain already did that for you. The directory `/captain/nginx-shared` in your server is available in your nginx container as `/nginx-shared`. Let's say you place a custom SSL cert in that folder and call it `/captain/nginx-shared/custom-cert.pem`. In order to reference that file in your nginx config, you'll use `/nginx-shared/custom-cert.pem`
