import { IApp } from '../models/IModels';

const DeployApi = require('../api/DeployApi');
const MachineHelper = require('../helpers/MachineHelper');

function initMachineFromLocalStorage() {
	const possibleApp = MachineHelper.apps.find((app: IApp) => app.cwd === process.cwd());

	if (possibleApp) {
		DeployApi.setMachineToDeploy(possibleApp.machineToDeploy);

		DeployApi.setAppName(possibleApp.appName);

		DeployApi.setBranchToPush(possibleApp.branchToPush);
	}
}

// Saves the app directory into local storage
function saveMachineToLocalStorage() {
	const apps = MachineHelper.apps;
	const currentDirectory = process.cwd();
	let appExists = false;
	// Update app
	const updatedApps = apps.map((app: IApp) => {
		if (app.cwd === currentDirectory) {
			appExists = true;

			return {
				cwd: app.cwd,
				appName: DeployApi.appName,
				branchToPush: DeployApi.branchToPush,
				machineToDeploy: DeployApi.machineToDeploy
			};
		}

		return app;
	});

	MachineHelper.setApps(updatedApps);

	if (!appExists) {
		const newApp = {
			cwd: process.cwd(),
			appName: DeployApi.appName,
			branchToPush: DeployApi.branchToPush,
			machineToDeploy: DeployApi.machineToDeploy
		};

		updatedApps.push(newApp);

		MachineHelper.setApps(apps);
	}
}

export = {
	initMachineFromLocalStorage,
	saveMachineToLocalStorage
};
