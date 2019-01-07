#!/usr/bin/env node

import * as inquirer from 'inquirer';
import StdOutUtil from '../utils/StdOutUtil';
import StorageHelper from '../utils/StorageHelper';
import Constants from '../utils/Constants';
import Utils from '../utils/Utils';
import CliHelper from '../utils/CliHelper';
import { IHashMapGeneric } from '../models/IHashMapGeneric';
import CliApiManager from '../api/CliApiManager';

const SAMPLE_DOMAIN = Constants.SAMPLE_DOMAIN;
const cleanUpUrl = Utils.cleanUpUrl;

async function login() {
	StdOutUtil.printMessage('Login to a CapRover Machine');

	const questions = [
		{
			type: 'input',
			default: SAMPLE_DOMAIN,
			name: 'captainAddress',
			message: '\nEnter address of the CapRover machine. \nIt is captain.[your-captain-root-domain] :',
			validate: (value: string) => {
				if (value === SAMPLE_DOMAIN) {
					return 'Enter a valid URL';
				}

				if (!cleanUpUrl(value)) return 'This is an invalid URL: ' + value;

				let found = undefined;
				StorageHelper.get().getMachines().map((machine) => {
					if (cleanUpUrl(machine.baseUrl) === cleanUpUrl(value)) {
						found = machine.name;
					}
				});

				if (found) {
					return `${value} already exist as ${found} in your currently logged in machines. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.`;
				}

				if (value && value.trim()) {
					return true;
				}

				return 'Please enter a valid address.';
			}
		},
		{
			type: 'confirm',
			name: 'captainHasRootSsl',
			message: 'Is HTTPS activated for this CapRover machine?',
			default: true
		},
		{
			type: 'password',
			name: 'captainPassword',
			message: 'Enter your password:',
			validate: (value: string) => {
				if (value && value.trim()) {
					return true;
				}

				return 'Please enter your password.';
			}
		},
		{
			type: 'input',
			name: 'captainName',
			message: 'Enter a name for this Captain machine:',
			default: CliHelper.get().findDefaultCaptainName(),
			validate: (value: string) => {
				value = value.trim();

				if (StorageHelper.get().findMachine(value)) {
					return `${value} already exist. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.`;
				}

				if (CliHelper.get().isNameValid(value)) {
					return true;
				}

				return 'Please enter a CapRover Name.';
			}
		}
	];
	const answers = (await inquirer.prompt(questions)) as IHashMapGeneric<string>;
	const { captainHasRootSsl, captainPassword, captainAddress, captainName } = answers;
	const handleHttp = captainHasRootSsl ? 'https://' : 'http://';
	const baseUrl = `${handleHttp}${cleanUpUrl(captainAddress)}`;

	try {
		const tokenToIgnore = await CliApiManager.get({
			authToken: '',
			baseUrl,
			name: captainName
		}).getAuthToken(captainPassword);

		StdOutUtil.printGreenMessage(`\nLogged in successfully to ${baseUrl}`);
		StdOutUtil.printGreenMessage(`Authorization token is now saved as ${captainName} \n`);
	} catch (error) {
		const errorMessage = error.message ? error.message : error;

		StdOutUtil.printError(`Something bad happened. Cannot save "${captainName}" \n${errorMessage}`);
	}
}

export default login;
