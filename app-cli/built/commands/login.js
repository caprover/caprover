#!/usr/bin/env node
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
const inquirer = require("inquirer");
const StdOutUtil_1 = require("../utils/StdOutUtil");
const StorageHelper_1 = require("../utils/StorageHelper");
const Constants_1 = require("../utils/Constants");
const Utils_1 = require("../utils/Utils");
const CliHelper_1 = require("../utils/CliHelper");
const CliApiManager_1 = require("../api/CliApiManager");
const SAMPLE_DOMAIN = Constants_1.default.SAMPLE_DOMAIN;
const cleanUpUrl = Utils_1.default.cleanUpUrl;
// const DeployApi = require('../api/DeployApi');
// const { cleanUpUrl, findDefaultCaptainName } = require('../utils/loginHelpers');
// const { SAMPLE_DOMAIN } = require('../utils/constants');
// const LoginApi = require('../api/LoginApi');
// In case the token is expired
// async function requestLogin() {
// 	const { baseUrl, name } = DeployApi.machineToDeploy;
// 	printMessage('Your auth token is not valid anymore. Try to login again.');
// 	const questions = [
// 		{
// 			type: 'password',
// 			name: 'captainPassword',
// 			message: 'Please enter your password for ' + baseUrl,
// 			validate: (value: string) => {
// 				if (value && value.trim()) {
// 					return true;
// 				}
// 				return 'Please enter your password for ' + baseUrl;
// 			}
// 		}
// 	];
// 	const loginPassword = await inquirer.prompt(questions);
// 	const password = loginPassword.captainPassword;
// 	const response = await LoginApi.loginMachine(baseUrl, password);
// 	const data = JSON.parse(response);
// 	const newToken = data.token;
// 	if (!newToken) return false;
// 	// Update the token to the machine that corresponds
// 	MachineHelper.updateMachineAuthToken(name, newToken);
// 	return true;
// }
function login() {
    return __awaiter(this, void 0, void 0, function* () {
        StdOutUtil_1.default.printMessage('Login to a Captain Machine');
        const questions = [
            {
                type: 'input',
                default: SAMPLE_DOMAIN,
                name: 'captainAddress',
                message: '\nEnter address of the Captain machine. \nIt is captain.[your-captain-root-domain] :',
                validate: (value) => {
                    if (value === SAMPLE_DOMAIN) {
                        return 'Enter a valid URL';
                    }
                    if (!cleanUpUrl(value))
                        return 'This is an invalid URL: ' + value;
                    StorageHelper_1.default.get().getMachines().map((machine) => {
                        if (cleanUpUrl(machine.baseUrl) === cleanUpUrl(value)) {
                            return `${value} already exist as ${machine.name}. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.`;
                        }
                    });
                    if (value && value.trim()) {
                        return true;
                    }
                    return 'Please enter a valid address.';
                }
            },
            {
                type: 'confirm',
                name: 'captainHasRootSsl',
                message: 'Is HTTPS activated for this Captain machine?',
                default: true
            },
            {
                type: 'password',
                name: 'captainPassword',
                message: 'Enter your password:',
                validate: (value) => {
                    if (value && value.trim()) {
                        return true;
                    }
                    return 'Please enter your password.';
                }
            },
            {
                type: 'input',
                name: 'captainName',
                message: 'Enter a name for this Captain machine:',
                default: CliHelper_1.default.get().findDefaultCaptainName(),
                validate: (value) => {
                    StorageHelper_1.default.get().getMachines().map((machine) => {
                        if (machine.name === value) {
                            return `${value} already exist. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.`;
                        }
                    });
                    if (value.match(/^[-\d\w]+$/i)) {
                        return true;
                    }
                    return 'Please enter a Captain Name.';
                }
            }
        ];
        const answers = (yield inquirer.prompt(questions));
        const { captainHasRootSsl, captainPassword, captainAddress, captainName } = answers;
        const handleHttp = captainHasRootSsl ? 'https://' : 'http://';
        const baseUrl = `${handleHttp}${cleanUpUrl(captainAddress)}`;
        try {
            const tokenToIgnore = yield CliApiManager_1.default.get({
                authToken: '',
                baseUrl,
                name: captainName
            }).getAuthToken(captainPassword);
            StdOutUtil_1.default.printGreenMessage(`Logged in successfully to ${baseUrl}`);
            StdOutUtil_1.default.printGreenMessage(`Authorization token is now saved as ${captainName} \n`);
        }
        catch (error) {
            const errorMessage = error.message ? error.message : error;
            StdOutUtil_1.default.printError(`Something bad happened. Cannot save "${captainName}" \n${errorMessage}`);
        }
    });
}
exports.default = login;
//# sourceMappingURL=login.js.map