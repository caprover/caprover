"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const MainApi = require('./MainApi');
const LoginApi = require('./LoginApi');
// const spinnerUtil = require("../../utils/spinner")
class SystemApi {
    constructor() {
        this.ipAddressOfServer = '';
        this.customDomainFromUser = '';
        this.newPasswordFirstTry = '';
    }
    setCustomDomainFromUser(newCustomDomainFromUser) {
        this.customDomainFromUser = newCustomDomainFromUser;
    }
    setIpAddressOfServer(newIpAddress) {
        this.ipAddressOfServer = newIpAddress.trim();
    }
    setCustomDomain(baseUrl, rootDomain) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customOptions = {
                    headers: {
                        'x-captain-auth': LoginApi.token
                    }
                };
                const data = yield MainApi.post(`${baseUrl}/api/v1/user/system/changerootdomain/`, {
                    rootDomain
                }, customOptions);
                return data;
            }
            catch (e) {
                throw e;
            }
        });
    }
    enableHttps(baseUrl, emailAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            const customOptions = {
                headers: {
                    'x-captain-auth': LoginApi.token
                }
            };
            try {
                const data = yield MainApi.post(`${baseUrl}/api/v1/user/system/enablessl/`, {
                    emailAddress
                }, customOptions);
                return data;
            }
            catch (e) {
                throw e;
            }
        });
    }
    forceHttps(baseUrl, isEnabled = true) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const customOptions = {
                    headers: {
                        'x-captain-auth': LoginApi.token
                    }
                };
                const data = yield MainApi.post(`${baseUrl}/api/v1/user/system/forcessl/`, {
                    isEnabled
                }, customOptions);
                return data;
            }
            catch (e) {
                throw e;
            }
        });
    }
}
module.exports = new SystemApi();
//# sourceMappingURL=SystemApi.js.map