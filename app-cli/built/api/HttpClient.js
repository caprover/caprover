"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ErrorFactory_1 = require("../utils/ErrorFactory");
const Logger_1 = require("../utils/Logger");
const Request = require("request-promise");
var TOKEN_HEADER = 'x-captain-auth';
var NAMESPACE = 'x-namespace';
var CAPTAIN = 'captain';
class HttpClient {
    constructor(baseUrl, authToken, onAuthFailure) {
        this.baseUrl = baseUrl;
        this.authToken = authToken;
        this.onAuthFailure = onAuthFailure;
        this.GET = 'GET';
        this.POST = 'POST';
        this.POST_DATA = 'POST_DATA';
        this.isDestroyed = false;
        //
    }
    createHeaders() {
        let headers = {};
        if (this.authToken)
            headers[TOKEN_HEADER] = this.authToken;
        headers[NAMESPACE] = CAPTAIN;
        // check user/appData or apiManager.uploadAppData before changing this signature.
        return headers;
    }
    setAuthToken(authToken) {
        this.authToken = authToken;
    }
    destroy() {
        this.isDestroyed = true;
    }
    fetch(method, endpoint, variables) {
        const self = this;
        return function () {
            return Promise.resolve() //
                .then(function () {
                if (!process.env.REACT_APP_IS_DEBUG)
                    return Promise.resolve();
                return new Promise(function (res) {
                    setTimeout(res, 500);
                });
            })
                .then(function () {
                return self.fetchInternal(method, endpoint, variables); //
            })
                .then(function (requestResponse) {
                const data = JSON.parse(requestResponse);
                if (data.status === ErrorFactory_1.default.STATUS_AUTH_TOKEN_INVALID) {
                    return self
                        .onAuthFailure() //
                        .then(function () {
                        return self
                            .fetchInternal(method, endpoint, variables)
                            .then(function (newRequestResponse) {
                            return newRequestResponse;
                        });
                    });
                }
                else {
                    return data;
                }
            })
                .then(function (data) {
                if (data.status !== ErrorFactory_1.default.OKAY && data.status !== ErrorFactory_1.default.OKAY_BUILD_STARTED) {
                    throw ErrorFactory_1.default.createError(data.status || ErrorFactory_1.default.UNKNOWN_ERROR, data.description || '');
                }
                return data;
            })
                .then(function (data) {
                // These two blocks are clearly memory leaks! But I don't have time to fix them now... I need to CANCEL the promise, but since I don't
                // have CANCEL method on the native Promise, I return a promise that will never RETURN if the HttpClient is destroyed.
                // Will fix them later... but it shouldn't be a big deal anyways as it's only a problem when user navigates away from a page before the
                // network request returns back.
                return new Promise(function (resolve, reject) {
                    // data.data here is the "data" field inside the API response! {status: 100, description: "Login succeeded", data: {…}}
                    if (!self.isDestroyed)
                        return resolve(data.data || { token: data.token }); // TODO remove || for API V2
                    Logger_1.default.dev('Destroyed then not called');
                });
            })
                .catch(function (error) {
                // Logger.log('');
                // Logger.error(error.message || error);
                return new Promise(function (resolve, reject) {
                    if (!self.isDestroyed)
                        return reject(error);
                    Logger_1.default.dev('Destroyed catch not called');
                });
            });
        };
    }
    fetchInternal(method, endpoint, variables) {
        if (method === this.GET)
            return this.getReq(endpoint, variables);
        if (method === this.POST || method === this.POST_DATA)
            return this.postReq(endpoint, variables, method);
        throw new Error('Unknown method: ' + method);
    }
    getReq(endpoint, variables) {
        const self = this;
        return Request.get(this.baseUrl + endpoint, {
            headers: self.createHeaders(),
            qs: variables
        }).then(function (data) {
            return data;
        });
    }
    postReq(endpoint, variables, method) {
        const self = this;
        if (method === this.POST_DATA)
            return Request.post(this.baseUrl + endpoint, {
                headers: self.createHeaders(),
                formData: variables
            }).then(function (data) {
                return data;
            });
        return Request.post(this.baseUrl + endpoint, {
            headers: self.createHeaders(),
            form: variables
        }).then(function (data) {
            return data;
        });
    }
}
exports.default = HttpClient;
//# sourceMappingURL=HttpClient.js.map