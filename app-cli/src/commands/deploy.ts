#!/usr/bin/env node

import * as inquirer from 'inquirer';
import StdOutUtil from '../utils/StdOutUtil';
import { validateIsGitRepository, validateDefinitionFile, ensureAuthentication } from '../utils/ValidationsHandler';
import { IMachine, IDeployedDirectory, IDeploySource, IDeployParams } from '../models/storage/StoredObjects';
import StorageHelper from '../utils/StorageHelper';
import CliHelper from '../utils/CliHelper';
import { IHashMapGeneric } from '../models/IHashMapGeneric';
import DeployHelper from '../utils/DeployHelper';
import CliApiManager from '../api/CliApiManager';

async function deploy(options: any) {
	const possibleApp = StorageHelper.get()
		.getDeployedDirectories()
		.find((dir: IDeployedDirectory) => dir.cwd === process.cwd());

	StdOutUtil.printMessage('Preparing deployment to Captain...\n');

	let deployParams: IDeployParams = { deploySource: {} };

	if (options.default) {
		deployParams = {
			captainMachine: possibleApp ? StorageHelper.get().findMachine(possibleApp.machineNameToDeploy) : undefined,
			deploySource: possibleApp ? possibleApp.deploySource : {},
			appName: possibleApp ? possibleApp.appName : undefined
		};
	}

	if (options.appName) {
		deployParams.appName = options.appName;
	}

	if (options.branch) {
		deployParams.deploySource.branchToPush = options.branch;
	}

	if (options.tarFile) {
		deployParams.deploySource.tarFilePath = options.tarFile;
	}

	if (!deployParams.deploySource.tarFilePath) {
		if (!validateIsGitRepository() || !validateDefinitionFile()) {
			return;
		}
	}

	if (options.pass || options.host) {
		if (options.pass && options.host) {
			deployParams.captainMachine = {
				authToken: '',
				baseUrl: options.host,
				name: ''
			};
			await CliApiManager.get(deployParams.captainMachine).getAuthToken(options.pass);
		} else {
			StdOutUtil.printError('host and pass should be either both defined or both undefined', true);
			return;
		}
	}

	// Show questions for what is being missing in deploy params
	let allApps: any = undefined;
	if (deployParams.captainMachine) {
		allApps = await ensureAuthentication(deployParams.captainMachine);
	}

	{
		const questions = [
			{
				type: 'list',
				name: 'captainNameToDeploy',
				default: possibleApp ? possibleApp.machineNameToDeploy : '',
				message: 'Select the Captain Machine you want to deploy to:',
				choices: CliHelper.get().getMachinesAsOptions(),
				when: () => !deployParams.captainMachine,
				filter: async (capName: string) => {
					deployParams.captainMachine = StorageHelper.get().findMachine(capName);
					if (deployParams.captainMachine) allApps = await ensureAuthentication(deployParams.captainMachine);
					return capName;
				}
			},
			{
				type: 'input',
				default:
					possibleApp && possibleApp.deploySource.branchToPush
						? possibleApp.deploySource.branchToPush
						: 'master',
				name: 'branchToPush',
				message: "Enter the 'git' branch you would like to deploy:",
				filter: async (branchToPushEntered: string) => {
					deployParams.deploySource.branchToPush = branchToPushEntered;
					return branchToPushEntered;
				},
				when: (answers: IHashMapGeneric<string>) =>
					!deployParams.deploySource.branchToPush &&
					!deployParams.deploySource.tarFilePath &&
					!!deployParams.captainMachine
			},
			{
				type: 'list',
				default: possibleApp ? possibleApp.appName : '',
				name: 'appName',
				message: 'Enter the Captain app name this directory will be deployed to:',
				choices: (answers: IHashMapGeneric<string>) => {
					return CliHelper.get().getAppsAsOptions(allApps);
				},
				filter: async (appNameEntered: string) => {
					deployParams.appName = appNameEntered;
					return appNameEntered;
				},
				when: (answers: IHashMapGeneric<string>) =>
					(!!deployParams.deploySource.branchToPush || !!deployParams.deploySource.tarFilePath) &&
					!deployParams.appName
			},
			{
				type: 'confirm',
				name: 'confirmedToDeploy',
				message:
					'Note that uncommitted files and files in gitignore (if any) will not be pushed to server. Please confirm so that deployment process can start.',
				default: true,
				when: (answers: IHashMapGeneric<string>) =>
					!!deployParams.appName &&
					!!deployParams.captainMachine &&
					(!!deployParams.deploySource.branchToPush || !!deployParams.deploySource.tarFilePath)
			}
		];
		const answersToIgnore = (await inquirer.prompt(questions)) as IHashMapGeneric<string>;

		if (!answersToIgnore.confirmedToDeploy) {
			StdOutUtil.printMessage('\nOperation cancelled by the user...\n');
			process.exit(0);
			return;
		}
	}

	try {
		await new DeployHelper(deployParams) //
			.startDeploy();
	} catch (e) {
		StdOutUtil.printError(e.message, true);
	}
}

export default deploy;
