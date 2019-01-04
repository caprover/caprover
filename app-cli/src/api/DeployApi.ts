import { IMachine } from '../models/IModels';
import MachineHelper from '../helpers/MachineHelper';

const MainApi = require('./MainApi');
const { DEFAULT_BRANCH_TO_PUSH, DEFAULT_APP_NAME } = require('../utils/constants');

class DeployApi {
	private machineToDeploy: IMachine | undefined;
	private branchToPush = DEFAULT_BRANCH_TO_PUSH;
	private appName = DEFAULT_APP_NAME;
	private appUrl = '';

	setMachineToDeploy(machineToDeploy: IMachine) {
		this.machineToDeploy = machineToDeploy;
	}

	updateMachineToDeploy(machineToDeploy: string) {
		let possibleMachine = {};

		// Look machine by host
		if (machineToDeploy.startsWith('http')) {
			this.machineToDeploy = MachineHelper.getMachines().find((machine) => machine.baseUrl === machineToDeploy)!;
		} else {
			// Look machine by name
			this.machineToDeploy = MachineHelper.getMachines().find((machine) => machine.name === machineToDeploy)!;
		}
	}

	setBranchToPush(branchToPush: string) {
		this.branchToPush = branchToPush;
	}

	setAppName(appName: string) {
		this.appName = appName;

		this.setAppUrl();
	}

	setAppUrl() {
		this.appUrl = this.machineToDeploy!.baseUrl
			.replace('//captain.', '//' + this.appName + '.')
			.replace('https://', 'http://');
	}

	async fetchBuildLogs() {
		try {
			const { authToken, baseUrl } = this.machineToDeploy!;
			const customOptions = {
				headers: {
					'x-captain-auth': authToken
				}
			};
			const data = await MainApi.get(`${baseUrl}/api/v1/user/appData/${this.appName}`, customOptions);

			return data;
		} catch (e) {
			throw e;
		}
	}

	async sendFile(sourceFile: string, gitHash: string) {
		try {
			const { authToken, baseUrl } = this.machineToDeploy!;
			const url = `${baseUrl}/api/v1/user/appData/${this.appName}/?detached=1`;
			const form = {
				sourceFile,
				gitHash
			};
			const options = {
				headers: {
					'x-captain-auth': authToken
				}
			};
			const data = await MainApi.postWithFile(url, form, options);

			return data;
		} catch (e) {
			throw e;
		}
	}

	// This is not moved to LoginAPI since it's related only for machineToDeploy
	async isAuthTokenValid() {
		try {
			if (!this.machineToDeploy) return false;

			const url = `${this.machineToDeploy.baseUrl}/api/v1/user/appDefinitions/`;
			const currentToken = this.machineToDeploy.authToken;
			const options = {
				headers: {
					'x-captain-auth': currentToken
				}
			};
			const response = await MainApi.get(url, options);
			const data = JSON.parse(response);

			// Tolken is not valid
			if (data.status === 1106 || data.status === 1105) {
				return false;
			}

			return true;
		} catch (e) {
			throw e;
		}
	}
}

export = new DeployApi();
