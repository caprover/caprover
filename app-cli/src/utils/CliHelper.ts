import StorageHelper from './StorageHelper';
import { IMachine } from '../models/storage/StoredObjects';
import StdOutUtil from './StdOutUtil';

export default class CliHelper {
	static instance: CliHelper;

	static get() {
		if (!CliHelper.instance) CliHelper.instance = new CliHelper();
		return CliHelper.instance;
	}

	isNameValid(value: string) {
		value = value || '';
		if (!!value && value.match(/^[-\d\w]+$/i) && value.indexOf('--') < 0) {
			return true;
		}
		return false;
	}

	getAppsAsOptions(apps: any[]) {
		const firstItemInOption = [
			{
				name: '-- CANCEL --',
				value: '',
				short: ''
			}
		];
		const listOfApps = apps.map((app) => {
			return {
				name: `${app.appName}`,
				value: `${app.appName}`,
				short: `${app.appName}`
			};
		});

		return [ ...firstItemInOption, ...listOfApps ];
	}

	getMachinesAsOptions() {
		const machines = StorageHelper.get().getMachines();
		const firstItemInOption = [
			{
				name: '-- CANCEL --',
				value: '',
				short: ''
			}
		];
		const listOfMachines = machines.map((machine) => {
			return {
				name: `${machine.name} at ${machine.baseUrl}`,
				value: `${machine.name}`,
				short: `${machine.name} at ${machine.baseUrl}`
			};
		});

		return [ ...firstItemInOption, ...listOfMachines ];
	}

	logoutMachine(machineName: string) {
		const removedMachine = StorageHelper.get().removeMachine(machineName);
		StdOutUtil.printMessage(`You are now logged out from ${removedMachine.name} at ${removedMachine.baseUrl}...\n`);
	}

	findDefaultCaptainName() {
		let currentSuffix = StorageHelper.get().getMachines().length + 1;
		const self = this;

		while (!self.isSuffixValid(currentSuffix)) {
			currentSuffix++;
		}

		return self.getCaptainFullName(currentSuffix);
	}

	getCaptainFullName(suffix: number) {
		const formatSuffix = suffix < 10 ? `0${suffix}` : suffix;

		return `captain-${formatSuffix}`;
	}

	isSuffixValid(suffixNumber: number) {
		const self = this;
		let valid = true;
		StorageHelper.get().getMachines().map((machine: IMachine) => {
			if (machine.name === self.getCaptainFullName(suffixNumber)) {
				valid = false;
			}
		});

		return valid;
	}
}
