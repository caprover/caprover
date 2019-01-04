"use strict";
const Request = require("request-promise");
class MainApi {
    constructor() {
        this.sharedOptions = {
            headers: {
                'x-namespace': 'captain'
            }
        };
    }
    _buildOptions(options) {
        if (!options)
            return this.sharedOptions;
        if (options.headers) {
            options.headers = Object.assign({}, this.sharedOptions.headers, options.headers);
        }
        return Object.assign({}, this.sharedOptions, options);
    }
    get(url, options) {
        const overrideOptions = this._buildOptions(options);
        const optionsToSend = Object.assign({}, overrideOptions, { url, method: 'GET' });
        return Request(optionsToSend);
    }
    post(url, form, options) {
        const overrideOptions = this._buildOptions(options);
        const optionsToSend = Object.assign({}, overrideOptions, { url, method: 'POST', form });
        return Request(optionsToSend);
    }
    postWithFile(url, formData, options) {
        const overrideOptions = this._buildOptions(options);
        const optionsToSend = Object.assign({}, overrideOptions, { url, method: 'POST', formData });
        return Request(optionsToSend);
    }
    put(url, form, options) {
        const overrideOptions = this._buildOptions(options);
        const optionsToSend = Object.assign({}, overrideOptions, { url, method: 'PUT', form });
        return Request(optionsToSend);
    }
    patch(url, form, options) {
        const overrideOptions = this._buildOptions(options);
        const optionsToSend = Object.assign({}, overrideOptions, { url, method: 'PATCH', form });
        return Request(optionsToSend);
    }
    delete(url, options) {
        const overrideOptions = this._buildOptions(options);
        const optionsToSend = Object.assign({}, overrideOptions, { url, method: 'DELETE' });
        return Request(optionsToSend);
    }
}
const instance = new MainApi();
module.exports = instance;
//# sourceMappingURL=MainApi.js.map