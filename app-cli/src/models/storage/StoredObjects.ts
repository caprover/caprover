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

export interface IDeploySource {
	branchToPush?: string;
	tarFilePath?: string;
}

export interface IDeployedDirectory {
	cwd: string;
	appName: string;
	deploySource: IDeploySource;
	machineNameToDeploy: string;
}

export interface IDeployParams {
	deploySource: IDeploySource;
	captainMachine?: IMachine;
	appName?: string;
}
