export interface IMachine {
	authToken: string;
	baseUrl: string;
	name: string;
}

export interface IOldSavedApp {
	cwd: string;
	appName: string;
	branchToPush: string;
	machineToDeploy: IMachine;
}

export interface IDeployedDirectory {
	cwd: string;
	appName: string;
	branchToPush: string;
	machineNameToDeploy: string;
}
