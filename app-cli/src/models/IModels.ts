export interface IApp {
	cwd: string;
	appName: string;
	branchToPush: string;
	machineToDeploy: IMachine;
}

export interface IMachine {
	name: string;
	authToken: string;
	baseUrl: string;
}
