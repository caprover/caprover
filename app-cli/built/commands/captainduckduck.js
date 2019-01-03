#!/usr/bin/env node
var printError = require("../utils/messageHandler").printError;
var packagejson = require("../../package.json");
var updateNotifier = require("update-notifier");
var program = require("commander");
updateNotifier({ pkg: packagejson }).notify({ isGlobal: true });
// Command actions
var serversetup = require("./serversetup");
var login = require("./login").login;
var logout = require("./logout");
var list = require("./list");
var deploy = require("./deploy");
// Setup
program.version(packagejson.version).description(packagejson.description);
// Commands
program
    .command("serversetup")
    .description("Performs necessary actions and prepares your Captain server.")
    .action(function () {
    serversetup();
});
program
    .command("login")
    .description("Login to a CaptainDuckDuck machine. You can be logged in to multiple machines simultaneously.")
    .action(function () {
    login();
});
program
    .command("logout")
    .description("Logout from a specific Captain machine.")
    .action(function () {
    logout();
});
program
    .command("list")
    .alias("ls")
    .description("List all Captain machines currently logged in.")
    .action(function () {
    list();
});
program
    .command("deploy")
    .description("Deploy your app (current directory) to a specific Captain machine. You'll be prompted to choose your Captain machine.")
    .option("-t, --tarFile <value>", "Specify file to be uploaded (rather than using git archive)")
    .option("-d, --default", "Run with default options")
    .option("-s, --stateless", "Run deploy stateless")
    .option("-h, --host <value>", "Only for stateless mode: Host of the captain machine")
    .option("-a, --appName <value>", "Only for stateless mode: Name of the app")
    .option("-p, --pass <value>", "Only for stateless mode: Password for Captain")
    .option("-b, --branch <value>", "Only for stateless mode: Branch name (default master)")
    .action(function (options) {
    deploy(options);
});
// Error on unknown commands
program.on("command:*", function () {
    var wrongCommands = program.args.join(" ");
    printError("\nInvalid command: " + wrongCommands + "\nSee --help for a list of available commands.", true);
});
program.parse(process.argv);
