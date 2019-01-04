import * as Request from 'request-promise';

interface IOptions {
	headers: any;
}

class MainApi {
	private sharedOptions: any;
	constructor() {
		this.sharedOptions = {
			headers: {
				'x-namespace': 'captain'
			}
		};
	}

	_buildOptions(options: IOptions) {
		if (!options) return this.sharedOptions;

		if (options.headers) {
			options.headers = Object.assign({}, this.sharedOptions.headers, options.headers);
		}

		return Object.assign({}, this.sharedOptions, options);
	}

	get(url: string, options: IOptions) {
		const overrideOptions = this._buildOptions(options);
		const optionsToSend = {
			...overrideOptions,
			url,
			method: 'GET'
		};

		return Request(optionsToSend);
	}

	post(url: string, form: any, options: IOptions) {
		const overrideOptions = this._buildOptions(options);
		const optionsToSend = {
			...overrideOptions,
			url,
			method: 'POST',
			form
		};

		return Request(optionsToSend);
	}

	postWithFile(url: string, formData: any, options: IOptions) {
		const overrideOptions = this._buildOptions(options);
		const optionsToSend = {
			...overrideOptions,
			url,
			method: 'POST',
			formData
		};

		return Request(optionsToSend);
	}

	put(url: string, form: any, options: IOptions) {
		const overrideOptions = this._buildOptions(options);
		const optionsToSend = {
			...overrideOptions,
			url,
			method: 'PUT',
			form
		};

		return Request(optionsToSend);
	}

	patch(url: string, form: any, options: IOptions) {
		const overrideOptions = this._buildOptions(options);
		const optionsToSend = {
			...overrideOptions,
			url,
			method: 'PATCH',
			form
		};

		return Request(optionsToSend);
	}

	delete(url: string, options: IOptions) {
		const overrideOptions = this._buildOptions(options);
		const optionsToSend = {
			...overrideOptions,
			url,
			method: 'DELETE'
		};

		return Request(optionsToSend);
	}
}

const instance = new MainApi();
export = instance;
