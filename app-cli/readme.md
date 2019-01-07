# CapRover CLI

Command Line Interface for CapRover. Fore more information see www.CapRover.com

CapRover is a modern automated app deployment & web server manager.
  - Deploy apps in your own space
  - Secure your services over HTTPS for FREE
  - Scale in seconds
  - Focus on your apps! Not the bells and whistles just to run your apps!

### Getting started!

This guide assumes that you have installed CapRover on a linux server.

You can use this CLI tool to deploy your apps. Before anything, install the CLI tool using npm:
```
npm install -g caprover
```

### Server Setup

The very first thing you need to do is to setup your CapRover server. You can either do this by visiting `HTTP://IP_ADDRESS_OF_SERVER:3000` in your browser, or the recommended way which is the command line tool. Simple run
```
caprover serversetup
```

Follow the steps as instructed, enter IP address of server. Enter the root domain to be used with this CapRover instance. If you don't know what CapRover root domain is, please visit www.CapRover.com for documentation. This is a very crucial step. After that, you'll be asked to enter your email address. This should be a valid email address as it will be used in your SSL certificate. After HTTPS is enabled, you'll be asked to change your password. And... Your are done! Go to Deploy section below to read more about app deployment.


### Login

*If you've done the "Server Setup" process through the command line. You can skip "Login" step because "server setup" automatically logs you in as the last step of setup.*

The very first thing you need to do is to login to your CapRover server. It is recommended that at this point you have already set up your HTTPS. Login over insecure, plain HTTP is not recommended.

To log in to server, simply run the following line and answer the questions.

```bash
caprover login
```

If operation finishes successfully, you will be prompted with a success message.

NOTE: You can be logged in to several CapRover servers at the same time. This is particularly useful if you have separate staging and production servers.

### Deploy

In order to deploy your application, you first need to create captain-definition file and place it in the root of your project folder. In case of a nodejs application, this would sit in the same folder as your package.json.

Captain definition file for a nodejs application is:

```
 {
  "schemaVersion" :1 ,
  "templateId" :"node/8.7.0"
 }
```


See https://caprover.com/docs/captain-definition-file.html for more details on Captain Definition file.

After making sure that this file exists, run the following command and answers questions:

```bash
caprover deploy
```

You will then see your application being uploaded, after that, your application getting built. Note that the build process takes multiple minutes, please be patient!

You can also deploy directly with one command:
```bash
caprover deploy -h https://captain.root.domain.com -a app-name -p password -b branchName
```

This can be useful if you want to integrate CI/CD pipeline.


### List logged in servers

To see a list of servers you are currently logged in to, run the following line:

```bash
caprover list
```

### Logout

Run the following command:

```bash
caprover logout
```
