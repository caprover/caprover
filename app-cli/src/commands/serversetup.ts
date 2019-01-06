#!/usr/bin/env node

import * as inquirer from 'inquirer';
import Constants from '../utils/Constants';
import StdOutUtil from '../utils/StdOutUtil';
import { isIpAddress } from '../utils/ValidationsHandler';
import { IMachine } from '../models/storage/StoredObjects';
import CliApiManager from '../api/CliApiManager';
import Utils from '../utils/Utils';
import CliHelper from '../utils/CliHelper';
import StorageHelper from '../utils/StorageHelper';
import ErrorFactory from '../utils/ErrorFactory';
import SpinnerHelper from '../utils/SpinnerHelper';

let newPasswordFirstTry: string | undefined = undefined;
let lastWorkingPassword: string = Constants.DEFAULT_PASSWORD;

let captainMachine: IMachine = {
	authToken: '',
	baseUrl: '',
	name: ''
};

const questions = [
	{
		type: 'list',
		name: 'hasInstalledCaptain',
		message:
			'Have you already installed Captain on your server by running the following line:' +
			'\nmkdir /captain && docker run -p 80:80 -p 443:443 -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck ?',
		default: 'Yes',
		choices: [ 'Yes', 'No' ],
		filter: (value: string) => {
			const answerFromUser = value.trim();

			if (answerFromUser === 'Yes') return answerFromUser;

			StdOutUtil.printMessage('\n\nCannot start the setup process if Captain is not installed.');

			StdOutUtil.printMessageAndExit(
				'Please read tutorial on CaptainDuckDuck.com to learn how to install CaptainDuckDuck on a server.'
			);
		}
	},
	{
		type: 'input',
		default: Constants.SAMPLE_IP,
		name: 'captainAddress',
		message: 'Enter IP address of your captain server:',
		filter: async (value: string) => {
			const ipFromUser = value.trim();

			if (ipFromUser === Constants.SAMPLE_IP || !isIpAddress(ipFromUser)) {
				StdOutUtil.printError(`\nThis is an invalid IP Address: ${ipFromUser}`, true);
			}

			try {
				// login using captain42. and set the ipAddressToServer
				captainMachine.baseUrl = `http://${ipFromUser}:3000`;
				await CliApiManager.get(captainMachine).getAuthToken(lastWorkingPassword);
			} catch (e) {
				// User may have used a different default password
				if (e.captainStatus === ErrorFactory.STATUS_WRONG_PASSWORD) return '';
				StdOutUtil.errorHandler(e);
			}

			return ipFromUser;
		}
	},
	{
		type: 'password',
		name: 'captainOriginalPassword',
		message: 'Enter your current password:',
		when: () => !captainMachine.authToken, // The default password didn't work
		filter: async (value: string) => {
			try {
				await CliApiManager.get(captainMachine).getAuthToken(value);
				lastWorkingPassword = value;
				return '';
			} catch (e) {
				StdOutUtil.errorHandler(e);
			}
		}
	},
	{
		type: 'input',
		name: 'captainRootDomain',
		message:
			'Enter a root domain for this Captain server. For example, enter test.yourdomain.com if you' +
			' setup your DNS to point *.test.yourdomain.com to ip address of your server' +
			': ',
		filter: async (value: string) => {
			const captainRootDomainFromUser = value.trim();
			try {
				await CliApiManager.get(captainMachine).updateRootDomain(captainRootDomainFromUser);
				captainMachine = Utils.copyObject(captainMachine);
				captainMachine.baseUrl = `http://captain.${captainRootDomainFromUser}`;
			} catch (e) {
				StdOutUtil.errorHandler(e);
			}

			return captainRootDomainFromUser;
		}
	},
	{
		type: 'password',
		name: 'newPasswordFirstTry',
		message: 'Enter a new password:',
		filter: (value: string) => {
			newPasswordFirstTry = value;
			return value;
		}
	},
	{
		type: 'password',
		name: 'newPassword',
		message: 'Enter your new password again:',
		filter: async (value: string) => {
			const confirmPasswordValueFromUser = value;

			if (newPasswordFirstTry !== confirmPasswordValueFromUser) {
				StdOutUtil.printError('Passwords do not match. Try serversetup again.', true);
				throw new Error('Password mismatch');
			}
			return '';
		}
	},
	{
		type: 'input',
		name: 'emailAddress',
		message: "Enter your 'valid' email address to enable HTTPS: ",
		filter: async (value: string) => {
			const emailAddressFromUser = value.trim();
			let forcedSsl = false;
			try {
				SpinnerHelper.start('Enabling SSL... Takes a few seconds...');
				await CliApiManager.get(captainMachine).enableRootSsl(emailAddressFromUser);

				captainMachine = Utils.copyObject(captainMachine);
				captainMachine.baseUrl = captainMachine.baseUrl.replace('http://', 'https://');

				await CliApiManager.get(captainMachine).forceSsl(true);
				forcedSsl = true;
				await CliApiManager.get(captainMachine).changePass(lastWorkingPassword, newPasswordFirstTry!);
				lastWorkingPassword = newPasswordFirstTry!;
				await CliApiManager.get(captainMachine).getAuthToken(lastWorkingPassword);
				SpinnerHelper.stop();
			} catch (e) {
				if (forcedSsl) {
					StdOutUtil.printError(
						'Server is setup, but password was not changed due to an error. You cannot use serversetup again.'
					);
					StdOutUtil.printError(
						`Instead, go to ${captainMachine.baseUrl} and change your password on settings page.`
					);
					StdOutUtil.printError(
						`Then, Use captainduckduck login on your local machine to connect to your server.`
					);
				}
				SpinnerHelper.fail();
				StdOutUtil.errorHandler(e);
			}

			return emailAddressFromUser;
		}
	},
	{
		type: 'input',
		name: 'captainName',
		message: 'Enter a name for this Captain machine:',
		default: CliHelper.get().findDefaultCaptainName(),
		validate: (value: string) => {
			const newMachineName = value.trim();

			let errorMessage = undefined;
			if (StorageHelper.get().findMachine(newMachineName)) {
				return `${newMachineName} already exist. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.`;
			}

			if (CliHelper.get().isNameValid(newMachineName)) {
				captainMachine.name = newMachineName;
				return true;
			}

			return 'Please enter a valid Captain Name. Small letters, numbers, single hyphen.';
		}
	}
];

async function serversetup() {
	StdOutUtil.printMessage('\nSetup your Captain server\n');

	const answersIgnore = await inquirer.prompt(questions);

	StorageHelper.get().saveMachine(captainMachine);

	StdOutUtil.printMessage(`\n\nCaptain is available at ${captainMachine.baseUrl}`);

	StdOutUtil.printMessage('\nFor more details and docs see http://www.captainduckduck.com\n\n');
}

export default serversetup;
