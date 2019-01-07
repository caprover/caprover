"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const StdOutUtil_1 = require("../utils/StdOutUtil");
const inquirer = require("inquirer");
const CliApiManager_1 = require("../api/CliApiManager");
// In case the token is expired
function requestLogin(machine) {
    return __awaiter(this, void 0, void 0, function* () {
        const { baseUrl } = machine;
        StdOutUtil_1.default.printMessage('Your auth token is not valid anymore. Try to login again.');
        const questions = [
            {
                type: 'password',
                name: 'captainPassword',
                message: 'Please enter your password for ' + baseUrl,
                validate: (value) => {
                    if (value && value.trim()) {
                        return true;
                    }
                    return 'Please enter your password for ' + baseUrl;
                }
            }
        ];
        const loginPassword = (yield inquirer.prompt(questions));
        const password = loginPassword.captainPassword;
        const responseIgnore = yield CliApiManager_1.default.get(machine).getAuthToken(password);
    });
}
exports.default = requestLogin;
//# sourceMappingURL=requestLogin.js.map