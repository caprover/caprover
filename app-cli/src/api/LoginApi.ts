const MainApi = require('./MainApi');
const SystemApi = require('./SystemApi');
const { DEFAULT_PASSWORD } = require('../utils/constants');

class LoginApi {
	private token = '';
	private oldPassword = DEFAULT_PASSWORD;

	setOldPassword(newPassword: string) {
		this.oldPassword = newPassword;
	}

	setToken(newToken: string) {
		this.token = newToken;
	}

	async loginMachine(baseUrl: string, password: string) {
		try {
			const data = await MainApi.post(`${baseUrl}/api/v1/login`, { password });
			const dataAsObject = JSON.parse(data);

			if (dataAsObject) {
				this.setToken(dataAsObject.token);
			}

			return data;
		} catch (e) {
			throw e;
		}
	}

	async changePass(baseUrl: string, newPassword: string) {
		try {
			const customOptions = {
				headers: {
					'x-captain-auth': this.token
				}
			};
			const form = {
				oldPassword: this.oldPassword,
				newPassword
			};
			const data = await MainApi.post(`${baseUrl}/api/v1/user/changepassword/`, form, customOptions);

			this.setToken(data.token);

			SystemApi.setIpAddressOfServer(baseUrl);

			return data;
		} catch (e) {
			throw e;
		}
	}
}

export = new LoginApi();
