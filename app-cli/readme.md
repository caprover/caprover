# Captain CLI

Command Line Interface for CaptainDuckDuck. Fore more information see www.CaptainDuckDuck.com

Captain is a modern automated app deployment & web server manager.
  - Deploy apps in your own space
  - Secure your services over HTTPS for FREE
  - Scale in seconds
  - Focus on your apps! Not the bells and whistles just to run your apps!

### Getting started!

This guide assumes that you have installed Captain on a linux server and was able to access it using the web interface.

You can use this CLI tool to deploy your apps. Before anything, install the CLI tool using npm:
```
npm install -g captainduckduck
```

### Login

The very first thing you need to do is to login to your Captain server. It is recommended that at this point you have already set up your HTTPS. Login over insecure, plain HTTP is not recommended.

To log in to server, simply run the following line and answer the questions.

```bash
captainduckduck login
```

If operation finishes successfully, you will be prompted with a success message.

NOTE: You can be logged in to several Captain servers at the same time. This is particularly useful if you have separate staging and production servers.

### Deploy

In order to deploy your application, you first need to create captain-definition file and place it in the root of your project folder. In case of a nodejs application, this would sit in the same folder as your package.json.

Captain definition file for a nodejs application is:

```
 {
  "schemaVersion" :1 ,
  "templateId" :"node/8.7.0"
 }
```


See https://github.com/githubsaturn/captainduckduck/blob/master/README.md for more details on Captain Definition file.

After making sure that this file exists, run the following command and answers questions:

```bash
captainduckduck deploy
```

You will then see your application being uploaded, after that, your application getting built. Note that the build process takes multiple minutes, please be patient!


### List logged in servers

To see a list of servers you are currently logged in to, run the following line:

```bash
captainduckduck list
```

### Logout

Run the following command:

```bash
captainduckduck logout
```