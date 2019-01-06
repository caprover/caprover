#!/usr/bin/env node

import * as inquirer from 'inquirer';
import StdOutUtil from '../utils/StdOutUtil';
import CliHelper from '../utils/CliHelper';

function generateQuestions() {
	const listOfMachines = CliHelper.get().getMachinesAsOptions();

	return [
		{
			type: 'list',
			name: 'captainNameToLogout',
			message: 'Select the Captain Machine you want to logout from:',
			choices: listOfMachines
		},
		{
			type: 'confirm',
			name: 'confirmedToLogout',
			message: 'Are you sure you want to logout from this Captain machine?',
			default: false,
			when: (answers: any) => answers.captainNameToLogout
		}
	];
}

async function logout() {
	const questions = generateQuestions();

	StdOutUtil.printMessage('Logout from a Captain Machine and clear auth info');

	const answers = await inquirer.prompt(questions);
	const { captainNameToLogout, confirmedToLogout } = answers;

	if (!captainNameToLogout || !confirmedToLogout) {
		StdOutUtil.printMessage('\nOperation cancelled by the user...\n');
		return;
	}

	CliHelper.get().logoutMachine(captainNameToLogout);
}

export default logout;
