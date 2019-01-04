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
const SystemApi = require('./SystemApi');
const { DEFAULT_PASSWORD } = require('../utils/constants');
class LoginApi {
    constructor() {
        this.token = '';
        this.oldPassword = DEFAULT_PASSWORD;
    }
    setOldPassword(newPassword) {
        this.oldPassword = newPassword;
    }
    setToken(newToken) {
        this.token = newToken;
    }
    loginMachine(baseUrl, password) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield MainApi.post(`${baseUrl}/api/v1/login`, { password });
                const dataAsObject = JSON.parse(data);
                if (dataAsObject) {
                    this.setToken(dataAsObject.token);
                }
                return data;
            }
            catch (e) {
                throw e;
            }
        });
    }
    changePass(baseUrl, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
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
                const data = yield MainApi.post(`${baseUrl}/api/v1/user/changepassword/`, form, customOptions);
                this.setToken(data.token);
                SystemApi.setIpAddressOfServer(baseUrl);
                return data;
            }
            catch (e) {
                throw e;
            }
        });
    }
}
module.exports = new LoginApi();
//# sourceMappingURL=LoginApi.js.map