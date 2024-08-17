## [Next Version - available as `edge`]

**IMPORTANT**: this version bumps the minimum Docker API to 1.43. Please run `docker version | grep API` before upgrading your CapRover installation.

-   New: Ability to delete multiple apps at once
-   New: Ability to setup automated disk cleanup
-   New: Support for custom Certbot commands allowing support for DNS challenges [Issue-1761](https://github.com/caprover/caprover/issues/1761)
-   New: Ability to search app logs on the web [Issue-149](https://github.com/caprover/caprover-frontend/issues/149)
-   New: Added support for Docker capabilities (enabling VPN one click apps etc)
-   Improved: Now the redirects include the path
-   Improved: SSH key handling to avoid human mistakes
-   Security: Updated npm dependencies security update
-   Security: Updated Certbot image (2.11.0)

## [1.11.1] - 2023-09-16

-   Fixed: Malformatted SSH issue [Issue-1863](https://github.com/caprover/caprover/issues/1863)
-   Fixed: Cannot save due to undefined property [Issue-1871](https://github.com/caprover/caprover/issues/1871)
-   New/Experimental: Added a helper script for disabling the OTP
-   Improved: Locking the nginx version to avoid unstable deployments and upgrades

## [1.11.0] - 2023-08-27

-   Improved: Pulling the new image before attempt to upgrade the CapRover engine to improve reliability of upgrades
-   Improved: Allowed custom git usernames [PR-1254](https://github.com/caprover/caprover/pull/1254)
-   Improved: Enabled gzip for the dashboard for a faster load
-   Improved: Allowed custom captain domain for webhooks [PR-1330](https://github.com/caprover/caprover/pull/1330)
-   Improved: Updated Netdata version [PR-1432](https://github.com/caprover/caprover/pull/1432). This is a major upgrade. Make sure to test your notifications and emails.
-   Improved: Added support for overwriting app defaults NGINX config [PR-1377](https://github.com/caprover/caprover/pull/1377)
-   Improved: Added support for overriding mesh network settings and using an existing Docker Swarm [56e739c](https://github.com/caprover/caprover/commit/56e739c0f57ce873bf8d032de838c415548041b7)
-   Improved: Updated the Docker image to use Alpine base image. Image size is now less than half!
-   New/Experimental: Added support for domain aliases (redirecting to specific domains) [PR-1744](https://github.com/caprover/caprover/pull/1744)
-   New/Experimental: Added support for app tags for grouping [PR-118](https://github.com/caprover/caprover-frontend/pull/118)
-   New/Experimental: Premium features (two factor auth, build success and failure alerts, login alerts) - will be rolled out gradually.
-   New/Experimental: Anonymous metric reporting added to CapRover. Please be sure to read TERMS_AND_CONDITIONS.md for details.
-   Fixed: Allowing dots to be present in repo names [PR-1553](https://github.com/caprover/caprover/pull/1553)

## [1.10.1] - 2021-10-09

-   Fixed: Fixed expired SSL certs issue [Issue-1215](https://github.com/caprover/caprover/issues/1215)
-   Fixed: On some VMs the initial installation used to fail due to issues with Docker's ingress network. [Issue-1206](https://github.com/caprover/caprover/issues/1206)
-   Fixed: CAPROVER_GIT_COMMIT_SHA wasn't available if deployed using webhook [Issue-1198](https://github.com/caprover/caprover/issues/1198)

## [1.10.0] - 2021-08-31

-   Fixed: Editing a docker remote registry does not trigger an authentication check [Issue-1027](https://github.com/caprover/caprover/issues/1027)
-   Fixed: Show Password caches the modal in registry [Issue-69](https://github.com/caprover/caprover-frontend/issues/69)
-   Fixed: Remember Me throws an error if the server restarts [Issue-1056](https://github.com/caprover/caprover/issues/1056)
-   New: Now git sha values are available during the build process and runtime as `CAPROVER_GIT_COMMIT_SHA` [PR-1094](https://github.com/caprover/caprover/pull/1049/files)
-   New: UI components and typeface are now more modern looking
-   New: Support for app tokens [Issue-698](https://github.com/caprover/caprover/issues/698)
-   New: Support for Markdown formatting in one click apps [Issue-1151](https://github.com/caprover/caprover/issues/1151)
-   Update: npm modules updated to the latest versions.

## [1.9.0] - 2021-02-15

-   New: Automatically adding Docker Hub credentials to the public images to improve limit rate [Issue-906](https://github.com/caprover/caprover/issues/906)
-   New: Dark mode is added [PR-62](https://github.com/caprover/caprover-frontend/pull/62)
-   New: Open in New Window functionality is added [PR-63](https://github.com/caprover/caprover-frontend/pull/63)
-   Fixed: Enable https on app only works if https is enabled on dashboard [Issue-998](https://github.com/caprover/caprover/issues/998)
-   Update: npm modules updated to the latest versions.

## [1.8.2] - 2020-11-02

-   Fixed: The following frontend bug fixes didn't make it to 1.8.1 due to a release mistake
-   Fixed: Logout did not clear cookies. [issue-810](https://github.com/caprover/caprover/issues/810)
-   Fixed: Creating a new app while another app is building breaks the UI [Issue-56](https://github.com/caprover/caprover-frontend/issues/56)

## [1.8.1] - 2020-10-31

-   New: CapRover now supports ARM processors [issue-445](https://github.com/caprover/caprover/issues/445)
-   Fixed: Logout did not clear cookies. [issue-810](https://github.com/caprover/caprover/issues/810)
-   Fixed: Creating a new app while another app is building breaks the UI [Issue-56](https://github.com/caprover/caprover-frontend/issues/56)

## [1.8.0] - 2020-08-16

-   New: Update Docker API to v1.40 - Make sure to have Docker v19.03 or above. [Issue-797](https://github.com/caprover/caprover/issues/797)
-   New: Change one-click app schema to be more compatible with Docker compose. [Issue-786](https://github.com/caprover/caprover/issues/786)
-   New: Added hostname support for one-click apps which was necessary for some apps. [Issue-404](https://github.com/caprover/caprover/issues/404)
-   New: Added ability to override docker service configs that are not present in CapRover (read-only volumes, CPU/RAM limitation and reservation and many more. [See docs](https://caprover.com/docs/service-update-override.html)
-   New: Allow logs timestamp to be disabled for services. [Issue-602](https://github.com/caprover/caprover/issues/602)
-   New: Added --advertise-addr for Docker swarm join. [Issue-572](https://github.com/caprover/caprover/issues/572)
-   New: Added deletion capability to selfhost Docker Registry. [Issue-580](https://github.com/caprover/caprover/issues/580)
-   New: Remove "Exposed Webapp" in apps table in favor of adding last deployed time. [Issue-47](https://github.com/caprover/caprover-frontend/issues/47)
-   New: Default to a Apps tab if the instance is fully set up. [Issue-48](https://github.com/caprover/caprover-frontend/issues/48)
-   Bugfix: Fixed a edge case where dhparam file is empty [Issue-745](https://github.com/caprover/caprover/issues/745)
-   Bugfix: Fixed an issue with app renaming where the app was deleted [Issue-701](https://github.com/caprover/caprover/issues/701)
-   Bugfix: Fixed an issue with HTTPS redirection on query parameters [PR-788](https://github.com/caprover/caprover/pull/788)
-   Security: Updated Node dependencies

## [1.7.1] - 2020-07-03

-   New: Improved TLS security settings for the built-in docker registry (https://github.com/caprover/caprover/pull/595)
-   New: Allowing custom ports for git remote repositories. (https://github.com/caprover/caprover/issues/606)
-   New: Default to http2 (https://github.com/caprover/caprover/pull/667)
-   New: Disallowing all contents on dashboard for robots (https://github.com/caprover/caprover-frontend/pull/38)
-   New: Added random hex generator for one click apps (https://github.com/caprover/caprover/issues/637)
-   New: Added ability to customize port and user when attaching a new node (https://github.com/caprover/caprover/issues/574)
-   New: Added a step to create dhparams during installation to improve security.
-   New: Added docker API version to the config params so that it can be changed by the users (https://github.com/caprover/caprover/issues/620)
-   New: Added ability to add 3rd party one-click app repositories (https://github.com/caprover/caprover/issues/691)
-   New: Added image name deploy to web UI panel - UI Improvement

-   Bugfix: Root domain change prevented nginx from booting up if a local registry was enabled (https://github.com/caprover/caprover/issues/686)
-   Bugfix: Refreshing the webhook URL to appear right after Save & Update (https://github.com/caprover/caprover-frontend/issues/41)
-   Bugfix: Fixed Certbot certs issues on servers without any active deploys in 30 days (https://github.com/caprover/caprover/issues/700)

-   Security: Updated Node version to 14
-   Security: Updated Node dependencies
-   Security: Updated Certbot to 1.5.0

-   Refactoring: Moved SSL configs to `http` context in nginx to avoid duplicating the snippet (https://github.com/caprover/caprover/commit/f896eef1cf64cd8433e1262e9d64f592b5b0caac). If you have customized nginx configs for your root, make sure to update it.

## [1.6.1] - 2020-01-02

-   Fixed dockerfile parsing warning: https://github.com/caprover/caprover/issues/570

## [1.6.0] - 2019-12-16

-   Improved renaming process. We now automatically generate new webhook when the app is renamed. (https://github.com/caprover/caprover/pull/499)
-   Improved renaming process - now checking for name clash before renaming. (https://github.com/caprover/caprover/pull/498)
-   Improved validation logic for the webhook build trigger. (https://github.com/caprover/caprover/pull/496)
-   Fixed bug with pulling from private registries running on custom ports, (https://github.com/caprover/caprover/pull/500)
-   Automatically focusing on password field upong admin page load.
-   Fixing Progressive Web App prsentation of the admin page (https://github.com/caprover/caprover-frontend/pull/24)
-   Keeping tabs on Apps Details page when the page reloads.
-   Allowing user to remove the webhook git repo info.
-   Blocking navigation when one-click app build is in progress.
-   Fixed new bug for monitoring on new installations (https://github.com/caprover/caprover/issues/550)
-   Envrionmental variables are now available during build time (https://github.com/caprover/caprover/pull/561)
-   Updated SSL default config (https://github.com/caprover/caprover/issues/562)
-   Updated new look for one-click apps! Now with logos and description!

## [1.5.2] - 2019-08-15

-   Fixed a problem with one-click app deployment on new installations. https://github.com/caprover/caprover/issues/481

## [1.5.1] - 2019-08-14

New features & Improvements:

-   Ablity to use websockets without having to manually edit nginx config (https://github.com/caprover/caprover/issues/439)
-   Double hyphen in "image name" is now changed to single hyphen, `img-captain--myapp` is now changed to `img-captain-myapp`. This is to address the problem with 3rd party docker registries. See (https://github.com/caprover/caprover/issues/454). Note that this is only applied to the newly built images. All existing images will stay intact. Also keep in mind that service names and volume names remain the same with double hyphens for now.
-   Builds are now being queued instead of dropping the build if another one is in progress. See (https://github.com/caprover/caprover/issues/266)
-   Ability to rename apps (https://github.com/caprover/caprover/issues/402)
-   Limiting login failures to avoid brute-forcing the password (https://github.com/caprover/caprover/issues/419)
-   Switched to fake certs for https catch all to avoid disclosing dashboard address.
-   Pulling nginx and certbot images to ensure smooth install even on buggy docker installations. See this: https://github.com/caprover/caprover/issues/450
-   Make the root domain available as a variable in one-click apps. See https://github.com/caprover/caprover/issues/435

Bug fixes:

-   Backup creation was fixed for instances that were migrated from CaptainDuckDuck
-   Python and Ruby templates were patched to allow using latest version of Linux automatically
-   updated npm packages to address potential vulnerabilities

## [1.4.0] - 2019-04-07

New Features:

-   Added SSH key support for git webhook automatic deploy (https://github.com/caprover/caprover/issues/342)
-   Added built-in support for HTTP basic auth (https://github.com/caprover/caprover/issues/336)
-   Added option to add some app notes (description) to your apps (https://github.com/caprover/caprover/issues/403)
-   Changed One-Click app selector to allow search (https://github.com/caprover/caprover/issues/394)
-   Setting maximum version history to last 50 versions to keep the config file small
-   Added Remember Me to web dashboard
-   Added option to delete volumes when persistent app is being deleted

Bug fixes:

-   Auto redirect after Force SSL was broken on frontend (https://github.com/caprover/caprover/issues/399)

## [1.3.0] - 2019-03-04

Added:

-   Backup capability added (for configs and SSL certs). See docs for more details.
-   Health checks are now excluded from CapRover and nginx logs
-   Front-end is now _almost_ mobile friendly.
-   Improved default SSL (https://github.com/caprover/caprover/issues/371)
-   Ability to change the root domain post installation

Fixed:

-   Web UI now waits for logs to get retrieved before sending another refresh. This fixes the rare case where the entire UI hangs because of Docker being unresponsive.
-   Fixed non English characters in the logs
-   Logs are now correctly sorted on the front-end

## [1.2.1] - 2019-02-11

Fixed

-   Pulling images from third party remote private repositories (https://github.com/caprover/caprover/issues/370)

## [1.2.0] - 2019-02-05

Awesome news for legacy CaptainDuckDuck users! You can now migrate to CapRover! See this:
https://caprover.com/docs/cdd-migration.html

Added:

-   Monorepos are now first class citizens, thanks to this suggestion https://github.com/caprover/caprover/issues/356#issuecomment-459675615 by @robgraeber
-   Custom One-Click apps. Now everyone can create a one click app as the templates are now easily testable. Use the last option in One-Click apps list (Template) and create a Pull Request here: https://github.com/caprover/one-click-apps
-   Force git build button
-   Hide/Show password clear text password fields
-   Fall back to `Dockerfile` if `captain-definition` file does not exist

Fixed:

-   Removal of Ports and Volumes (https://github.com/caprover/caprover/issues/355)
-   Not saving SMTP if username is not provided (some password managers autofill password field!)
-   Fixed deploy when some version are manually removed from `config-captain.json` file.

Donation campaign launched ❤
https://opencollective.com/caprover#backer

## [1.1.0] - 2019-01-27

### Features:

Fixed:

-   Persistent data directory with fixed path (https://github.com/caprover/caprover/issues/351)

Added:

-   App Logs are now accessible via dashboard (https://github.com/caprover/caprover/issues/196)

### Dev:

-   Backend and frontend dependencies updated

## [1.0.0] - 2019-01-19

**Major Update. Renamed from CaptainDuckDuck to CapRover**

Script for upgrading from CaptainDuckDuck to CapRover will be ready in a few weeks, [here](https://caprover.com/docs/cdd-migration.html).

### Breaking Changes:

-   schemaVersion in captain-definition file is now upgraded to 2
-   The extra ./src prefix is no longer needed for captain-definition dockerfiles. You need to remove ./src from the first argument in your COPY and ADD statements in your dockerfileLines

### Features:

-   One Click Rollback
-   Improved build logs on webview.
-   Improved downtime between deploys
-   Allowing Dockerfile to be referenced in captain-definition (https://github.com/caprover/caprover/issues/113)
-   Ability to reference imageName inside captain-definition directly when you want o deploy an already built image from DockerHub.
-   Easy to copy and paste environmental variables UI: (https://github.com/caprover/caprover/issues/256)
-   Added a separate one-click repository which can be updated continuously - built based on docker compose (https://github.com/caprover/one-click-apps)
-   Ability to simply copy and paste a Dockerfile and captain-definition files on web dashboard.
-   Improved cluster support by adding ability to turn on/off the registry, have multiple private registries, change default registry.
-   Web dashboard UI improvements.

### Dev work:

-   Backend rewrite in TypeScript.
-   Frontend rewrite in TypeScript via React + ant.design
-   CLI rewrite in TypeScript
-   Updated Certbot (Let's Encrypt)

## [V0.7.3] - 2018-11-28

-   npm package updates for major security vulnerabilities
-   Updated default tags for MySQL in WordPress
-   Updated links in the front end app
-   Fixed the issue with HTTPS repos https://github.com/githubsaturn/captainduckduck/issues/283
-   Fixed port mapping disabled on app push
-   Added VSTS Agent as one-click app

## [V0.7.2] - 2018-05-16

Starting V0.7.0, nginx was no longer using the Docker routing mesh, this was done to support showing real IPs behind requests. However, this caused issues on servers that have their ports blocked by firewall, see https://github.com/githubsaturn/captainduckduck/issues/237

Although it's not a bug in CaptainDuckDuck, it might cause confusion for new users, hence, a precheck for firewall test is added to the installation phase. If a firewall on important ports is detected, the user will be warned with a proper message and an instruction on how to disable firewall.

## [V0.7.1] - 2018-05-14

Added:

-   Ability to override default values. This includes overriding default Captain dashboard subdomain and etc.
-   Allowing precheck for wildcard domain to be skipped if the provider doesn't support wildcard
-   One-click apps can now be deployed with specific tags (versions)
-   The user can now optionally change the instance count of persistent apps.
-   Unused images clean up added to settings

Improved:

-   Back button works as expected in apps settings page
-   Sticky footer for Save and Delete buttons on the app page
-   Move Docker registry settings to Nodes page from the main dashboard page
-   Revealing real IP by using `mode=host` for nginx

## [V0.6.0] - 2018-02-10

Added:

-   Build logs are now available on web dashboard, you can view build logs initiated with Github webhooks as well.
-   Added Redis as a one-click app
-   Added prechecks on OS and Docker version when installing CaptainDuckDuck to ensure maximum compatibility

Fixed:

-   NetData container removal is retrofitted to avoid some Docker deadlocks
-   Flashing issue for logged out state on Dashboard
-   Login issue on small phone screen
-   Fixed issue with very long domain names

Improved:

-   Default client max size for Captain is changed to 500mb
-   Message for self-hosted registry is changed to be more clear so user won't be surprised with an expected error
-   More details on error messages related to custom domains

## [0.5.3] - 2018-01-11

Fixed:

-   Third-party private registries limited via username scope were not correctly getting authenticated (https://github.com/githubsaturn/captainduckduck/commit/81fe0408b05dae0d9f4c84c5546c54dfb6845259)

Improved:

-   Push error are now throwing proper error rather than confusing 500 error
-   If something fails when app is getting created, the premature entry is now automatically deleted from the app database

## [V0.5.1] - 2018-01-09

**BREAKING CHANGES:**:

-   Make sure that your CLI version is at least `1.0.11`
    -- To check your current version: `captainduckduck -V`
    -- To update: `sudo npm install -g captainduckduck`
-   Breaking change in your `captain-definition` files:
    -- if you have `python` as your template, you should change it to `python-django`
-   Setting a max on log size files does not apply to existing containers. To use the same log size cap for current services, run:

```
docker service update  --log-driver json-file --log-opt max-size=512m  captain-nginx
docker service update  --log-driver json-file --log-opt max-size=512m  captain-captain
docker service update  --log-driver json-file --log-opt max-size=512m  captain-certbot
docker service update  --log-driver json-file --log-opt max-size=512m  captain-registry
docker service update  --log-driver json-file --log-opt max-size=512m  captain-app1   # replace app 1 and app 2 with your app names
docker service update  --log-driver json-file --log-opt max-size=512m  captain-app2    # replace app 1 and app 2 with your app names
```

### Features added:

-   Ruby/Rack support added (see https://github.com/githubsaturn/captainduckduck/pull/45)
-   Support for showing build logs when deploying via command line added (https://github.com/githubsaturn/captainduckduck/commit/b64c3172df5dc8da1970e64d480f9a546ec53851). Simply running `captainduckduck deploy` now shows the build logs.
-   Added CouchDB as one-click app

### Improved:

-   Added UDP protocol to Port Forwarding (previously it was only TCP)
-   Container log files are now maxed at 512MB per container by default in order to avoid high unnecessary disk usage. It can be changed by updating service manually, e.g., `docker service update srv-captain--app-name --log-driver json-file --log-opt max-size=2048m`
-   Captain now runs a `docker container prune` to clean up stopped containers
-   NetData startup script improved and auto restart is now enabled by default
-   Wrong app name during deploy now returns a more specific message to hint the user instead of plain 500

## [0.4.0] - 2017-12-31

New:

-   Added ability to Enorce HTTPS for apps! (https://github.com/githubsaturn/captainduckduck/issues/2)
-   Advanced users are now able to customize their nginx configurations (allowing http2, process counts, cache config, custom redirects and etc). https://github.com/githubsaturn/captainduckduck/issues/44
-   Added a custom `nginx-shared` directory for using custom files in nginx container (https://github.com/githubsaturn/captainduckduck/issues/71). Using this combined with customized nginx config, you can use custom SSL certificates, custom static assets and etc.
-   Persistent directories (volumes) can now be specified as path on host machine.

Improved:

-   Health-check calls are now more reliable with the newly added timeout.

Fixed:

-   Force HTTPS button on web dashboard now gets disabled if Force HTTPS is activated. (https://github.com/githubsaturn/captainduckduck/commit/efc43849e892e6f1032072f4c64317f0946b23af)

CLI (1.0.9):

-   Added a `--default` flag to `captainduckduck deploy` to avoid re-entering server address and other information.

## [0.3.1] - 2017-12-27

Fixed:

-   In cluster mode, the initial instance was always getting created on main node due to wrong image tag (https://github.com/githubsaturn/captainduckduck/commit/c6e9e4b0c25181ecf9ae7f8eec42379685a6726c)
-   GitLab support added for automated deployment

Improved:

-   Deploy now reports all kinds of errors. No more ambiguous status 500 error.
-   Changed healthcheck interval to 20sec from 5sec to make the logs less verbose

CLI improvements (1.0.8)

-   Fixed logout causing all other instances to get logged out
-   Improved deploy process by pre-checking `captain-definition` file.
-   Improved saving app name if it's getting re-deployed.

## [0.3.0] - 2017-12-19

Features:

-   :octocat: automatic branch tracking and deployment through Github and Bitbucket :confetti_ball:
-   Added ability to expose container ports and map them to host ports
-   Adding ability to change nodeId of apps with persistent data
-   Added ability to set a custom initial password instead of `captain42`
-   Allow customDomain === rootDomain, see https://github.com/githubsaturn/captainduckduck/pull/24
-   Improve build error messages by including last 20 lines of logs that led to build error.
-   Changed max request size to 500mb for apps (temporary solution until fully customizable nginx config is ready)

Bugfixes:

-   Instance count of `0` is not respected. FIXED. https://github.com/githubsaturn/captainduckduck/issues/48#issuecomment-352289264

Breaking Change:

-   If you were manually setting port mapping on your containers before this release, make sure to re-map them through Captain interface. Since port mapping is added to the interface, Captain would override the current port mapping that you might have on your containers. If you didn't manually modified your containers `--publish-add` flag, you don't need to worry about this.

## [ v0.2.2] - 2017-12-05

Hotfix:

-   Fix a bug in web UI that was introduced in v0.2.1. Save configuration button was not functioning.

## [0.2.1] - 2017-12-04

A major release!! 🎉🎉

**New Features:**

-   Support for Persistent Data:
    Previously, Captain only had support for apps with no persistent. The main drawback was that one could not deploy a database using Captain. Now the feature is fully supported.
-   One-click apps:
    This is perhaps the most interesting feature of new release. Although adding support for persistent data, technically speaking, was enough for the developers to deploy databases. But wouldn't it be nicer if installing MySql, MongoDB and etc becomes as easy as selecting a name from a list? :wink: Done! Not only that, off-the-shelf apps are being slowly added to this list. Installing WordPress, Parse-Server, Tumbor is now as easy as installing apps on your phone!

**Improvements:**

-   New tabular design for the apps page enables you to have tens of apps and be able to navigate easily from one to another.
-   Deployment from the web interface now accepts tar archive files of the source directory, not necessarity content. See https://github.com/githubsaturn/captainduckduck/issues/22

## [0.1.2] - 2017-11-17

Bugfixes:

-   Added support for build errors: now build errors get reported as build failure and the image is not created. Previously, build errors were being ignored.

Improvements:

-   Fixed multiple typos
-   Added more details on how apps internally can talk to each other
-   Added functionality to disable "Expose As Web App". Now if you are deploying an app that's only being used as an internal service, you have the option not to expose it via a public URL. This is also useful when in the next release Captain starts supporting databases as they are web-apps at all.
-   Added underlying structure for supporting databases. Since it's not thoroughly tested, the UI is still hidden.
