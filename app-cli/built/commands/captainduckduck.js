#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const packagejson = require('../../package.json');
const updateNotifier = require("update-notifier");
updateNotifier({ pkg: packagejson }).notify({ isGlobal: true });
const StdOutUtil_1 = require("../utils/StdOutUtil");
const program = require("commander");
// Command actions
const login_1 = require("./login");
const list_1 = require("./list");
const logout_1 = require("./logout");
const deploy_1 = require("./deploy");
const serversetup_1 = require("./serversetup");
// Setup
program.version(packagejson.version).description(packagejson.description);
// Commands
program
    .command('login')
    .description('Login to a CaptainDuckDuck machine. You can be logged in to multiple machines simultaneously.')
    .action(() => {
    login_1.default();
});
program.command('list').alias('ls').description('List all Captain machines currently logged in.').action(() => {
    list_1.default();
});
program.command('logout').description('Logout from a specific Captain machine.').action(() => {
    logout_1.default();
});
program
    .command('serversetup')
    .description('Performs necessary actions and prepares your Captain server.')
    .action(() => {
    serversetup_1.default();
});
program
    .command('deploy')
    .description("Deploy your app (current directory) to a specific Captain machine. You'll be prompted to choose your Captain machine.\n\n" +
    'For use in scripts, i.e. non-interactive mode, you can use --host --pass --appName and -- branch flags.')
    .option('-d, --default', 'Use previously entered values for the current directory, avoid asking.')
    .option('-t, --tarFile <value>', 'Specify the tar file to be uploaded (rather than using git archive)')
    .option('-h, --host <value>', 'Specify th URL of the captain machine in command line')
    .option('-a, --appName <value>', 'Specify Name of the app to be deployed in command line')
    .option('-p, --pass <value>', 'Specify password for Captain in command line')
    .option('-b, --branch <value>', 'Specify branch name (default master)')
    .action((options) => {
    deploy_1.default(options);
});
// Error on unknown commands
program.on('command:*', () => {
    const wrongCommands = program.args.join(' ');
    StdOutUtil_1.default.printError(`\nInvalid command: ${wrongCommands}\nSee --help for a list of available commands.`, true);
});
program.parse(process.argv);
//# sourceMappingURL=captainduckduck.js.map