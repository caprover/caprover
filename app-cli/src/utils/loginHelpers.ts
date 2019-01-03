import { IMachine } from '../models/IModels';

const MachineHelper = require('../helpers/MachineHelper');

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
	let currentSuffix = MachineHelper.machines.length + 1;

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
	MachineHelper.machines.map((machine: IMachine) => {
		machine.name !== getCaptainFullName(suffixNumber);
	});

module.exports = {
	cleanUpUrl,
	findDefaultCaptainName,
	isSuffixValid,
	getCaptainFullName
};
