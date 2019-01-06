#!/usr/bin/env node

const packagejson = require('../../package.json');
import * as updateNotifier from 'update-notifier';
updateNotifier({ pkg: packagejson }).notify({ isGlobal: true });

import StdOutUtil from '../utils/StdOutUtil';
import * as program from 'commander';

// Command actions
import login from './login';
import list from './list';
import logout from './logout';
import deploy from './deploy';
import serversetup from './serversetup';

// Setup
program.version(packagejson.version).description(packagejson.description);

// Commands

program
	.command('login')
	.description('Login to a CaptainDuckDuck machine. You can be logged in to multiple machines simultaneously.')
	.action(() => {
		login();
	});

program.command('list').alias('ls').description('List all Captain machines currently logged in.').action(() => {
	list();
});

program.command('logout').description('Logout from a specific Captain machine.').action(() => {
	logout();
});

program
	.command('serversetup')
	.description('Performs necessary actions and prepares your Captain server.')
	.action(() => {
		serversetup();
	});

program
	.command('deploy')
	.description(
		"Deploy your app (current directory) to a specific Captain machine. You'll be prompted to choose your Captain machine."
	)
	.option('-t, --tarFile <value>', 'Specify file to be uploaded (rather than using git archive)')
	.option('-d, --default', 'Run with default options')
	.option('-s, --stateless', 'Run deploy stateless')
	.option('-h, --host <value>', 'Only for stateless mode: Host of the captain machine')
	.option('-a, --appName <value>', 'Only for stateless mode: Name of the app')
	.option('-p, --pass <value>', 'Only for stateless mode: Password for Captain')
	.option('-b, --branch <value>', 'Only for stateless mode: Branch name (default master)')
	.action((options: any) => {
		deploy(options);
	});

// Error on unknown commands
program.on('command:*', () => {
	const wrongCommands = program.args.join(' ');

	StdOutUtil.printError(`\nInvalid command: ${wrongCommands}\nSee --help for a list of available commands.`, true);
});

program.parse(process.argv);
