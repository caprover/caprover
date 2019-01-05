import StorageHelper from './StorageHelper';
import { IMachine } from '../models/storage/StoredObjects';

export default class CliHelper {
	static instance: CliHelper;

	static get() {
		if (!CliHelper.instance) CliHelper.instance = new CliHelper();
		return CliHelper.instance;
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
