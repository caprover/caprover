# Contributing

When contributing to this repository, please first discuss the change you wish to make via issue,
email, or any other method with the owners of this repository before making a change. The best way is our Telegram channel:

`https://join.slack.com/t/captainduckduck/shared_invite/enQtNDEwMjc3MjcxNjUzLWQ4YjljN2JiMGU5Nzk5NjcwMDEzNDNiMTNkOTVhNTA4YTYwOThkNDkyMTlkMDFhMzAzOTA5YjcwY2E4NWRkYzk`


Please note we have a code of conduct, please follow it in all your interactions with the project.

## Pull Request Process

1. IF APPLICABLE: Update the README.md with details of changes to the interface, this includes new environment 
   variables, exposed ports, useful file locations and container parameters.
2. Make sure your commit comments are self explanatory.
3. Discuss the changes you want to make beforehand.
4. To keep the process simple with just a few contributors, development happens directly on the master branch
   and releases will be deployed on the same branch.
   
## Running dev environment

First, you need a Captain instance running in debug mode, this can be a remote server, a VM on your local machine,
or your local machine itself. Needless to say, Docker is required (same minimum version as mentioned in README)

> Docker for Mac users: You need to add `/captain` to shared paths.  
> To do so, click on the Docker icon -> Preferences -> File Sharing and add `/captain`

Log in to your machine, clone the git repo, go to `app-backend` directory and run the following lines:

```bash
$   npm install
$   ./dev-clean-run-as-dev.sh
```
You are good to go! You can run the following line to see the logs for the back-end service.

```bash
docker service logs captain-captain --follow
```
The main differences between the release and debug mode are:
- docker image is created from the local source file, instead of getting pulled from Docker hub
- security is much weaker is debug due to a static salt
- self health monitoring is disabled in debug so that we can see possible crashes
- same origin policy is disabled in debug mode to make front end development easier
- an additional endpoint is available at `/force-exit` which force restarts the backend service
- static resources (including front end app) are not being served in debug build.

Captain by default uses `captain.localhost` as its root domain. It's not always needed, but if you need a root
domain for your development, you can simply run a local DNS server on your local machine and point
`*.captain-x` (wild card domain) to your local IP. A simple `hosts` change won't be useful as we need a wildcard entry.
On ubuntu 16, it's as simple of editing this file:
`/etc/NetworkManager/dnsmasq.d/dnsmasq-localhost.conf` (create if does not exist)
And add this line to it: `address=/captain.localhost/192.168.1.2` where `192.168.1.2` is your local IP address.
To make sure you have dnsmasq, you can run `which dnsmasq` on your terminal, if it's available,
path of it will be printed on the terminal, otherwise, there won't be anything printed on your terminal.


### front end development:
First, you simply run the debug build for the backend service as explained above.
Then go to `app-frontend` and run follow the installation guide explained in
frontend app [README.md](https://github.com/githubsaturn/captainduckduck/tree/master/app-frontend#installation)

Change the endpoint for the backend server to your debug instance by editing this file:
`/captainduckduck/app-frontend/src/js/captain/apiManager.js` and uncomment the correct line
- `BASE_API = 'http://captain.captain.localhost/api/v1/'` if you have dnsmasq installed
- `BASE_API = 'http://127.0.0.1:3000/api/v1/'` if you don't have dnsmasq installed

You need to hardcode a logged in user to avoid having to log it with every refresh of the page. To do so, steal the auth token from the network inspector on Chrome and hardcode it in apiManager.js.
You can simply replace `var authToken = null` with `var authToken = 'THE_AUTH_TOKEN_STOLEN_FROM_NETWORK_INSPECTOR'`

### CLI development:
Just simply install dependencies in `app-cli` directory by running `npm install` and you are good to go!

### Backend development:
Start the debug build for the backend service as explained above. To see any changes you make,
first save the changes, then you need to restart the service either by sending a request to `/force-exit` endpoint,
or by running `./dev-reset-service.sh` script which is available in `app-backend` directory.

### Security Issues
Security issues are high priority and they will be addressed immediately. If you find a security issue, please do not post as a public issue, instead, please email it to us: captainduckduck.github@gmail.com


## Code of Conduct

### Our Pledge

In the interest of fostering an open and welcoming environment, we as
contributors and maintainers pledge to making participation in our project and
our community a harassment-free experience for everyone, regardless of age, body
size, disability, ethnicity, gender identity and expression, level of experience,
nationality, personal appearance, race, religion, or sexual identity and
orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment
include:

* Using welcoming and inclusive language
* Being respectful of differing viewpoints and experiences
* Gracefully accepting constructive criticism
* Focusing on what is best for the community
* Showing empathy towards other community members

Examples of unacceptable behavior by participants include:

* The use of sexualized language or imagery and unwelcome sexual attention or
advances
* Trolling, insulting/derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information, such as a physical or electronic
  address, without explicit permission
* Other conduct which could reasonably be considered inappropriate in a
  professional setting

### Our Responsibilities

Project maintainers are responsible for clarifying the standards of acceptable
behavior and are expected to take appropriate and fair corrective action in
response to any instances of unacceptable behavior.

Project maintainers have the right and responsibility to remove, edit, or
reject comments, commits, code, wiki edits, issues, and other contributions
that are not aligned to this Code of Conduct, or to ban temporarily or
permanently any contributor for other behaviors that they deem inappropriate,
threatening, offensive, or harmful.

### Scope

This Code of Conduct applies both within project spaces and in public spaces
when an individual is representing the project or its community. Examples of
representing a project or community include using an official project e-mail
address, posting via an official social media account, or acting as an appointed
representative at an online or offline event. Representation of a project may be
further defined and clarified by project maintainers.

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported by contacting the project team. All
complaints will be reviewed and investigated and will result in a response that
is deemed necessary and appropriate to the circumstances. The project team is
obligated to maintain confidentiality with regard to the reporter of an incident.
Further details of specific enforcement policies may be posted separately.

Project maintainers who do not follow or enforce the Code of Conduct in good
faith may face temporary or permanent repercussions as determined by other
members of the project's leadership.

### Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage], version 1.4,
available at [http://contributor-covenant.org/version/1/4][version]

[homepage]: http://contributor-covenant.org
[version]: http://contributor-covenant.org/version/1/4/
