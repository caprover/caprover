import { IMachine } from '../models/IModels';
import MachineHelper from '../helpers/MachineHelper';

function cleanUpUrl(url: string) {
	if (!url || !url.length) return null;

	let cleanedUrl = url;
	const hasSlashAtTheEnd = url.substr(url.length - 1, 1) === '/';

	if (hasSlashAtTheEnd) {
		// Remove the slash at the end
		cleanedUrl = url.substr(0, url.length - 1);
	}

	return cleanedUrl.replace('http://', '').replace('https://', '').trim();
}

function findDefaultCaptainName() {
	let currentSuffix = MachineHelper.getMachines().length + 1;

	while (!isSuffixValid(currentSuffix)) {
		currentSuffix++;
	}

	return getCaptainFullName(currentSuffix);
}

function getCaptainFullName(suffix: number) {
	const formatSuffix = suffix < 10 ? `0${suffix}` : suffix;

	return `captain-${formatSuffix}`;
}

const isSuffixValid = (suffixNumber: number) =>
	MachineHelper.getMachines().map((machine: IMachine) => {
		machine.name !== getCaptainFullName(suffixNumber);
	});

export = {
	cleanUpUrl,
	findDefaultCaptainName,
	isSuffixValid,
	getCaptainFullName
};
