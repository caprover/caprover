export interface IApp {
	cwd: string;
	appName: string;
	branchToPush: string;
	machineToDeploy: string;
}

export interface IMachine {
	name: string;
}
