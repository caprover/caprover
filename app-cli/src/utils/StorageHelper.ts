import { IMachine, IDeployedDirectory, IOldSavedApp } from '../models/storage/StoredObjects';
import * as ConfigStore from 'configstore';
import Utils from './Utils';

const CAP_MACHINES = 'CapMachines';
const DEPLOYED_DIRS = 'DeployedDirs';

export default class StorageHelper {
	static instance: StorageHelper;

	static get() {
		if (!StorageHelper.instance) StorageHelper.instance = new StorageHelper();
		return StorageHelper.instance;
	}

	private data: ConfigStore;

	constructor() {
		this.data = new ConfigStore('captainduckduck');
		this.migrateData();
	}

	migrateData() {
		const self = this;
		const data = this.data;
		const oldMachines: any[] = data.get('captainMachines') || [];
		const oldApps: IOldSavedApp[] = data.get('apps') || [];
		oldMachines.forEach((m) => {
			self.saveMachine({
				authToken: m.authToken,
				baseUrl: m.baseUrl,
				name: m.name
			});
		});

		oldApps.forEach((app) => {
			self.saveDeployedDirectory({
				appName: app.appName,
				cwd: app.cwd,
				machineNameToDeploy: app.machineToDeploy.name,
				deploySource: {
					branchToPush: app.branchToPush
				}
			});
		});

		data.delete('captainMachines');
		data.delete('apps');
	}

	getMachines(): IMachine[] {
		return Utils.copyObject(this.data.get(CAP_MACHINES) || []);
	}

	findMachine(machineName: string) {
		return this.getMachines().find((m) => m.name === machineName);
	}

	removeMachine(machineName: string) {
		const machines = this.getMachines();
		const removedMachine = machines.filter((machine) => machine.name === machineName)[0];
		const newMachines = machines.filter((machine) => machine.name !== machineName);
		this.data.set(CAP_MACHINES, newMachines);

		return removedMachine;
	}

	saveMachine(machineToSaveOrUpdate: IMachine) {
		const currMachines = this.getMachines();
		let updatedMachine = false;
		for (let index = 0; index < currMachines.length; index++) {
			const element = currMachines[index];
			if (element.name === machineToSaveOrUpdate.name) {
				updatedMachine = true;
				currMachines[index] = machineToSaveOrUpdate;
				break;
			}
		}

		if (!updatedMachine) {
			currMachines.push(machineToSaveOrUpdate);
		}

		this.data.set(CAP_MACHINES, currMachines);
	}

	getDeployedDirectories(): IDeployedDirectory[] {
		return Utils.copyObject(this.data.get(DEPLOYED_DIRS) || []);
	}

	saveDeployedDirectory(directoryToSaveOrUpdate: IDeployedDirectory) {
		const currDirs = this.getDeployedDirectories();
		let updatedDir = false;
		for (let index = 0; index < currDirs.length; index++) {
			const element = currDirs[index];
			if (element.cwd === directoryToSaveOrUpdate.cwd) {
				updatedDir = true;
				currDirs[index] = directoryToSaveOrUpdate;
				break;
			}
		}

		if (!updatedDir) {
			currDirs.push(directoryToSaveOrUpdate);
		}

		this.data.set(DEPLOYED_DIRS, currDirs);
	}
}
