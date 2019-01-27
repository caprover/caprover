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


console.log('*************** DEPRECATION NOTICE *******************')
console.log('******************************************************')
console.log(' ')
console.log(' ')
console.log('     CaptainDuckDuck is now updated, rebranded and distributed as CapRover. See CapRover.com for details.')
console.log(' ')
console.log(' ')
console.log('******************************************************')

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
		"Deploy your app (current directory) to a specific Captain machine. You'll be prompted to choose your Captain machine.\n\n" +
			'For use in scripts, i.e. non-interactive mode, you can use --host --pass --appName and -- branch flags.'
	)
	.option('-d, --default', 'Use previously entered values for the current directory, avoid asking.')
	.option('-t, --tarFile <value>', 'Specify the tar file to be uploaded (rather than using git archive)')
	.option('-h, --host <value>', 'Specify th URL of the captain machine in command line')
	.option('-a, --appName <value>', 'Specify Name of the app to be deployed in command line')
	.option('-p, --pass <value>', 'Specify password for Captain in command line')
	.option('-b, --branch <value>', 'Specify branch name (default master)')
	.action((options: any) => {
		deploy(options);
	});

// Error on unknown commands
program.on('command:*', () => {
	const wrongCommands = program.args.join(' ');

	StdOutUtil.printError(`\nInvalid command: ${wrongCommands}\nSee --help for a list of available commands.`, true);
});

program.parse(process.argv);
