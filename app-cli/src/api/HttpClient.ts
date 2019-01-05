import axios from 'axios';
import ErrorFactory from '../utils/ErrorFactory';
import Logger from '../utils/Logger';

var TOKEN_HEADER = 'x-captain-auth';
var NAMESPACE = 'x-namespace';
var CAPTAIN = 'captain';

export default class HttpClient {
	public readonly GET = 'GET';
	public readonly POST = 'POST';
	public isDestroyed = false;

	constructor(private baseUrl: string, private authToken: string, private onAuthFailure: () => Promise<any>) {
		//
	}

	createHeaders() {
		let headers: any = {};
		if (this.authToken) headers[TOKEN_HEADER] = this.authToken;
		headers[NAMESPACE] = CAPTAIN;

		// check user/appData or apiManager.uploadAppData before changing this signature.
		return headers;
	}

	setAuthToken(authToken: string) {
		this.authToken = authToken;
	}

	destroy() {
		this.isDestroyed = true;
	}

	fetch(method: 'GET' | 'POST', endpoint: string, variables: any) {
		const self = this;
		return function(): Promise<any> {
			return Promise.resolve() //
				.then(function() {
					if (!process.env.REACT_APP_IS_DEBUG) return Promise.resolve();
					return new Promise<void>(function(res) {
						setTimeout(res, 500);
					});
				})
				.then(function() {
					return self.fetchInternal(method, endpoint, variables); //
				})
				.then(function(axiosResponse) {
					const data = axiosResponse.data; // this is an axios thing!
					if (data.status === ErrorFactory.STATUS_AUTH_TOKEN_INVALID) {
						return self
							.onAuthFailure() //
							.then(function() {
								return self.fetchInternal(method, endpoint, variables).then(function(newAxiosResponse) {
									return newAxiosResponse.data;
								});
							});
					} else {
						return data;
					}
				})
				.then(function(data) {
					if (data.status !== ErrorFactory.OKAY && data.status !== ErrorFactory.OKAY_BUILD_STARTED) {
						throw ErrorFactory.createError(
							data.status || ErrorFactory.UNKNOWN_ERROR,
							data.description || ''
						);
					}
					return data;
				})
				.then(function(data) {
					// These two blocks are clearly memory leaks! But I don't have time to fix them now... I need to CANCEL the promise, but since I don't
					// have CANCEL method on the native Promise, I return a promise that will never RETURN if the HttpClient is destroyed.
					// Will fix them later... but it shouldn't be a big deal anyways as it's only a problem when user navigates away from a page before the
					// network request returns back.
					return new Promise(function(resolve, reject) {
						// data.data here is the "data" field inside the API response! {status: 100, description: "Login succeeded", data: {…}}
						if (!self.isDestroyed) return resolve(data.data || { token: data.token }); // TODO remove || for API V2
						Logger.dev('Destroyed then not called');
					});
				})
				.catch(function(error) {
					Logger.error(error.message || error);
					return new Promise(function(resolve, reject) {
						if (!self.isDestroyed) return reject(error);
						Logger.dev('Destroyed catch not called');
					});
				});
		};
	}

	fetchInternal(method: 'GET' | 'POST', endpoint: string, variables: any) {
		if (method === this.GET) return this.getReq(endpoint, variables);

		if (method === this.POST) return this.postReq(endpoint, variables);

		throw new Error('Unknown method: ' + method);
	}

	getReq(endpoint: string, variables: any) {
		const self = this;
		return axios
			.get(this.baseUrl + endpoint, {
				params: variables,
				headers: self.createHeaders()
			}) //
			.then(function(data) {
				//console.log(data);
				return data;
			});
	}

	postReq(endpoint: string, variables: any) {
		const self = this;
		return axios
			.post(this.baseUrl + endpoint, variables, {
				headers: self.createHeaders()
			}) //
			.then(function(data) {
				//console.log(data);
				return data;
			});
	}
}
