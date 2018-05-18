Regardless of your deployment method, make sure that you have a 'captain-definition' file in your project. See docs for more details:
https://github.com/githubsaturn/captainduckduck/wiki/Captain-Definition-File

## Deploy via CLI
Simply run `captainduckduck deploy` in your git repo and follow the steps. This is the best method as it's the only method that reports potential build failures to you. Read more about it here:
https://github.com/githubsaturn/captainduckduck/wiki/Getting-Started#step-4-deploy-the-test-app

## Deploy via Web Dashboard
Zip the content of your project into a tarball (`.tar`), go to your Captain web dashboard and upload the tar file.


## Deploy using Github, Bitbucket and etc.
This method is perhaps the most convinient one. This method automatically triggers a build when you push your repo to a specific branch (like `master` or `staging` or etc). To setup this, go to your apps settings and enter the repo information:
- github/bitbucket username(email address): This is username that will be used when Captain downloads the repo.
- github/bitbucket password: You can enter any non-empty text, like `123456`, for public projects.
- repo: This is the main HTTPS address of repo, in case of github, it is in `github.com/someone/something` format.
- branch: The branch you want to be tracked, for example `master` or `production`...

After you enter this information, save your configuration. And go to your apps page again. Now, you'll see a new field call webhook. Simply copy this webhook to your github/bitbucket repo. Captain listens to `POST` requests on this link and triggers a build.

On Github, webhooks can be added here:
- Project > Settings > Add Webhook > URL: Captain Webhook from your apps page, Content Type: `application/json`, 
Secret: <Leave empty>, Just the `push` event.

On Bitbucket, webhooks can be added here:
- Project > Settings > Webhooks > Add Webhook > Title: Captain Server, URL: Captain Webhook from your apps page.


## Post Deploy Script
This script will run right before your container (i.e. app) gets updated due to a configuration change or app deploy. In this script, you can modify the Docker service object, invoke an HTTP call, and literally do anything. The template for this script is:
```
var preDeployFunction = function (captainAppObj, dockerUpdateObject) {
	return Promise.resolve()
		.then(function(){

		    // Do something in a Promise form

		    // In the end, return the "possibly-modified" dockerUpdateObject
		    return dockerUpdateObject;
		});
};

```

Note that `captainAppObj`, is the app object as saved in `/captain/config.conf` file, and `dockerUpdateObject` is the service update object that is being passed to Docker to update the service (environmental vars, image version and etc). This object is as per [Docker docs].(https://docs.docker.com/engine/api/v1.30/#operation/ServiceUpdate)

Since this script will be executed in CaptainDuckDuck process, you'll get access to all node dependecies that CaptainDuckDuck has, see [here](https://github.com/githubsaturn/captainduckduck/blob/master/app-backend/package.json). For example, the following script injects a UUID mapped to the deployed version to service label with every update:

```
var uuid = require('uuid/v4');

var preDeployFunction = function (captainAppObj, dockerUpdateObject) {
	return Promise.resolve()
		.then(function(){

		    dockerUpdateObject.TaskTemplate.ContainerSpec.Labels[uuid()] = captainAppObj.deployedVersion+ '';
		    return dockerUpdateObject;
		});
};

```

Note that this pre-deploy script, particularly Docker service update object, is complicated. Hence, it is strongly recommended to use this pre-deploy method if you are an expert user. For example, note that how an empty string is being added to the deployed version in this line:

```
dockerUpdateObject.TaskTemplate.ContainerSpec.Labels[uuid()] = captainAppObj.deployedVersion+ '';
```

Removing this causes an error. To see logs, you need to run `docker service logs captain-captain --follow`. Even the error from Docker is not very clear. All in all, this is an advanced feature and is not recommended for beginners and intermiate users.