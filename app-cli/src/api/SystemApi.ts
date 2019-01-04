const MainApi = require('./MainApi');
const LoginApi = require('./LoginApi');
// const spinnerUtil = require("../../utils/spinner")

class SystemApi {
	private ipAddressOfServer = '';
	private customDomainFromUser = '';
	private newPasswordFirstTry = '';

	setCustomDomainFromUser(newCustomDomainFromUser: string) {
		this.customDomainFromUser = newCustomDomainFromUser;
	}

	setIpAddressOfServer(newIpAddress: string) {
		this.ipAddressOfServer = newIpAddress.trim();
	}

	async setCustomDomain(baseUrl: string, rootDomain: string) {
		try {
			const customOptions = {
				headers: {
					'x-captain-auth': LoginApi.token
				}
			};
			const data = await MainApi.post(
				`${baseUrl}/api/v1/user/system/changerootdomain/`,
				{
					rootDomain
				},
				customOptions
			);

			return data;
		} catch (e) {
			throw e;
		}
	}

	async enableHttps(baseUrl: string, emailAddress: string) {
		const customOptions = {
			headers: {
				'x-captain-auth': LoginApi.token
			}
		};

		try {
			const data = await MainApi.post(
				`${baseUrl}/api/v1/user/system/enablessl/`,
				{
					emailAddress
				},
				customOptions
			);

			return data;
		} catch (e) {
			throw e;
		}
	}

	async forceHttps(baseUrl:string, isEnabled = true) {
		try {
			const customOptions = {
				headers: {
					'x-captain-auth': LoginApi.token
				}
			};
			const data = await MainApi.post(
				`${baseUrl}/api/v1/user/system/forcessl/`,
				{
					isEnabled
				},
				customOptions
			);

			return data;
		} catch (e) {
			throw e;
		}
	}
}

export = new SystemApi();
