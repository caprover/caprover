import { IMachine, IApp } from '../models/IModels';

const { printMessage } = require('../utils/messageHandler');
const configstore = require('configstore');
const packagejson = require('../../package.json');
const configs = new configstore(packagejson.name, {
	captainMachines: []
});

class MachineHelper {
	private machines: IMachine[];
	private apps: IApp[];
	constructor() {
		this.machines = configs.get('captainMachines');

		this.apps = configs.get('apps');
	}

	getMachinesAsOptions() {
		const firstItemInOption = [
			{
				name: '-- CANCEL --',
				value: '',
				short: ''
			}
		];
		const listOfMachines = this.machines.map((machine) => {
			return {
				name: `${machine.name} at ${machine.baseUrl}`,
				value: `${machine.name}`,
				short: `${machine.name} at ${machine.baseUrl}`
			};
		});

		return [ ...firstItemInOption, ...listOfMachines ];
	}

	getMachines() {
		return this.machines;
	}

	setMachines(newMachines: IMachine[]) {
		this.machines = newMachines;

		configs.set('captainMachines', newMachines);
	}

	updateMachineAuthToken(machineName: string, authToken: string) {
		let updatedMachine: IMachine;
		const newMachines = this.machines.map((machine) => {
			if (machine.name === machineName) {
				updatedMachine = {
					...machine,
					authToken
				};

				return updatedMachine;
			}

			return machine;
		});

		this.setMachines(newMachines);

		this.updateAppsAuthToken(updatedMachine!);
	}

	updateAppsAuthToken(updatedMachine: IMachine) {
		if (!updatedMachine) return;

		const newApps = this.apps.map((app) => {
			if (app.machineToDeploy.name === updatedMachine.name) {
				return {
					...app,
					machineToDeploy: updatedMachine
				};
			}

			return app;
		});

		this.setApps(newApps);
	}

	setApps(newApps: IApp[]) {
		this.apps = newApps;

		configs.set('apps', newApps);
	}

	addMachine(newMachine: IMachine) {
		const tempMachines = this.machines;
		const newMachines = [ ...tempMachines, newMachine ];

		// Add to local storage
		configs.set('captainMachines', newMachines);

		this.setMachines(configs.get('captainMachines'));
	}

	logoutMachine(machineName: string) {
		const removedMachine = this.machines.filter((machine) => machine.name === machineName)[0];
		const newMachines = this.machines.filter((machine) => machine.name !== machineName);

		this.setMachines(newMachines);

		printMessage(`You are now logged out from ${removedMachine.name} at ${removedMachine.baseUrl}...\n`);
	}
}

const instance = new MachineHelper();

export default instance;
