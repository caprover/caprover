#!/usr/bin/env node

import * as inquirer from 'inquirer';
import StdOutUtil from '../utils/StdOutUtil';
import { validateIsGitRepository, validateDefinitionFile, ensureAuthentication } from '../utils/ValidationsHandler';
import { IMachine, IDeployedDirectory } from '../models/storage/StoredObjects';
import StorageHelper from '../utils/StorageHelper';
import CliHelper from '../utils/CliHelper';
import { IHashMapGeneric } from '../models/IHashMapGeneric';
import DeployHelper from '../utils/DeployHelper';

// async function deployAsStateless(host: string, appName: string, branch: string, pass: string) {
// 	const isStateless = host && appName && branch && pass;

// 	if (isStateless) {
// 		// login first
// 		StdOutUtil.printMessage(`Trying to login to ${host}\n`);

// 		const { name } = DeployApi.machineToDeploy;
// 		const response = await LoginApi.loginMachine(host, pass);
// 		const data = JSON.parse(response);
// 		const newToken = data.token;

// 		// Update the token to the machine that corresponds (if needed)
// 		MachineHelper.updateMachineAuthToken(name, newToken);

// 		if (data) {
// 			StdOutUtil.printMessage(`Starting stateless deploy to\n${host}\n${branch}\n${appName}`);

// 			deployFromGitProject();
// 		}
// 	} else {
// 		StdOutUtil.printError(
// 			'You are missing parameters for deploying on stateless. <host> <password> <app name> <branch>'
// 		);
// 	}
// }

// async function deployFromTarFile(tarFile: string) {
// 	try {
// 		const isValidAuthentication = await validateAuthentication();

// 		if (isValidAuthentication) {
// 			// Send from tar file
// 			const filePath = tarFile;
// 			const gitHash = 'sendviatarfile';

// 			await uploadFile(filePath, gitHash);
// 		} else {
// 			StdOutUtil.printError('Incorrect login details', true);
// 		}
// 	} catch (e) {
// 		StdOutUtil.printError(e.message, true);
// 	}
// }

async function deploy(options: any) {
	const possibleApp = StorageHelper.get()
		.getDeployedDirectories()
		.find((dir: IDeployedDirectory) => dir.cwd === process.cwd());

	if (!options.tarFile) {
		if (!validateIsGitRepository() || !validateDefinitionFile()) {
			return;
		}
	}

	StdOutUtil.printMessage('Preparing deployment to Captain...\n');

	let deployParams: IHashMapGeneric<string> = possibleApp
		? {
				captainNameToDeploy: possibleApp.machineNameToDeploy,
				branchToPush: possibleApp.branchToPush,
				appName: possibleApp.appName
			}
		: {};

	if (options.default) { // TODO
		//deployAsDefaultValues();
		//}
		// else if (options.stateless) {
		// 	deployAsStateless(options.host, options.appName, options.branch, options.pass);
		// }
		// else if (options.tarFile) {
		// 	deployFromTarFile(options.tarFile);
	} else {
		const questions = [
			{
				type: 'list',
				name: 'captainNameToDeploy',
				default: possibleApp ? possibleApp.machineNameToDeploy : '',
				message: 'Select the Captain Machine you want to deploy to:',
				choices: CliHelper.get().getMachinesAsOptions()
			},
			{
				type: 'input',
				default: possibleApp ? possibleApp.branchToPush : 'master',
				name: 'branchToPush',
				message: "Enter the 'git' branch you would like to deploy:",
				when: (answers: IHashMapGeneric<string>) => !!answers.captainNameToDeploy
			},
			{
				type: 'input',
				default: possibleApp ? possibleApp.appName : '',
				name: 'appName',
				message: 'Enter the Captain app name this directory will be deployed to:',
				when: (answers: IHashMapGeneric<string>) => !!answers.branchToPush
			},
			{
				type: 'confirm',
				name: 'confirmedToDeploy',
				message:
					'Note that uncommitted files and files in gitignore (if any) will not be pushed to server. Please confirm so that deployment process can start.',
				default: true,
				when: (answers: IHashMapGeneric<string>) => !!answers.appName
			}
		];
		const answers = (await inquirer.prompt(questions)) as IHashMapGeneric<string>;

		if (!answers.confirmedToDeploy) {
			StdOutUtil.printMessage('\nOperation cancelled by the user...\n');
			process.exit(0);
			return;
		}
		deployParams = answers;
	}

	const branchToPush = deployParams.branchToPush;
	const appName = deployParams.appName;
	const capMachine = StorageHelper.get()
		.getMachines()
		.find((machine) => machine.name === deployParams.captainNameToDeploy)!;

	try {
		await new DeployHelper(capMachine, appName, branchToPush) //
			.deployFromGitProject();
	} catch (e) {
		StdOutUtil.printError(e.message, true);
	}
}

export default deploy;
