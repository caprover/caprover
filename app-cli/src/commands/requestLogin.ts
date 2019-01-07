import StdOutUtil from '../utils/StdOutUtil';
import * as inquirer from 'inquirer';
import { IMachine } from '../models/storage/StoredObjects';
import CliApiManager from '../api/CliApiManager';

// In case the token is expired
export default async function requestLogin(machine: IMachine) {
	const { baseUrl } = machine;

	StdOutUtil.printMessage('Your auth token is not valid anymore. Try to login again.');

	const questions = [
		{
			type: 'password',
			name: 'captainPassword',
			message: 'Please enter your password for ' + baseUrl,
			validate: (value: string) => {
				if (value && value.trim()) {
					return true;
				}

				return 'Please enter your password for ' + baseUrl;
			}
		}
	];
	const loginPassword = (await inquirer.prompt(questions)) as any;
	const password = loginPassword.captainPassword;
	const responseIgnore = await CliApiManager.get(machine).getAuthToken(password);
}
