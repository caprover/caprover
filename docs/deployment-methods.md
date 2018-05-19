---
id: deployment-methods
title: Deployment Methods
sidebar_label: Deployment Methods
---

<br/>
Regardless of your deployment method, make sure that you have a 'captain-definition' file in your project. See docs on [Captain Definition](captain-definition-file.md) for more details.

## Deploy via CLI
Simply run `captainduckduck deploy` in your git repo and follow the steps. This is the best method as it's the only method that reports potential build failures to you. Read more about it here:
 [Get Started - Step 4](get-started.md#step-4-deploy-the-test-app).

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


