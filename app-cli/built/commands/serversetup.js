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
const Constants_1 = require("../utils/Constants");
const StdOutUtil_1 = require("../utils/StdOutUtil");
const ValidationsHandler_1 = require("../utils/ValidationsHandler");
const CliApiManager_1 = require("../api/CliApiManager");
const Utils_1 = require("../utils/Utils");
const CliHelper_1 = require("../utils/CliHelper");
const StorageHelper_1 = require("../utils/StorageHelper");
const ErrorFactory_1 = require("../utils/ErrorFactory");
const SpinnerHelper_1 = require("../utils/SpinnerHelper");
let newPasswordFirstTry = undefined;
let lastWorkingPassword = Constants_1.default.DEFAULT_PASSWORD;
let captainMachine = {
    authToken: '',
    baseUrl: '',
    name: ''
};
const questions = [
    {
        type: 'list',
        name: 'hasInstalledCaptain',
        message: 'Have you already installed Captain on your server by running the following line:' +
            '\nmkdir /captain && docker run -p 80:80 -p 443:443 -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck ?',
        default: 'Yes',
        choices: ['Yes', 'No'],
        filter: (value) => {
            const answerFromUser = value.trim();
            if (answerFromUser === 'Yes')
                return answerFromUser;
            StdOutUtil_1.default.printMessage('\n\nCannot start the setup process if Captain is not installed.');
            StdOutUtil_1.default.printMessageAndExit('Please read tutorial on CaptainDuckDuck.com to learn how to install CaptainDuckDuck on a server.');
        }
    },
    {
        type: 'input',
        default: Constants_1.default.SAMPLE_IP,
        name: 'captainAddress',
        message: 'Enter IP address of your captain server:',
        filter: (value) => __awaiter(this, void 0, void 0, function* () {
            const ipFromUser = value.trim();
            if (ipFromUser === Constants_1.default.SAMPLE_IP || !ValidationsHandler_1.isIpAddress(ipFromUser)) {
                StdOutUtil_1.default.printError(`\nThis is an invalid IP Address: ${ipFromUser}`, true);
            }
            try {
                // login using captain42. and set the ipAddressToServer
                captainMachine.baseUrl = `http://${ipFromUser}:3000`;
                yield CliApiManager_1.default.get(captainMachine).getAuthToken(lastWorkingPassword);
            }
            catch (e) {
                // User may have used a different default password
                if (e.captainStatus === ErrorFactory_1.default.STATUS_WRONG_PASSWORD)
                    return '';
                StdOutUtil_1.default.errorHandler(e);
            }
            return ipFromUser;
        })
    },
    {
        type: 'password',
        name: 'captainOriginalPassword',
        message: 'Enter your current password:',
        when: () => !captainMachine.authToken,
        filter: (value) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield CliApiManager_1.default.get(captainMachine).getAuthToken(value);
                lastWorkingPassword = value;
                return '';
            }
            catch (e) {
                StdOutUtil_1.default.errorHandler(e);
            }
        })
    },
    {
        type: 'input',
        name: 'captainRootDomain',
        message: 'Enter a root domain for this Captain server. For example, enter test.yourdomain.com if you' +
            ' setup your DNS to point *.test.yourdomain.com to ip address of your server' +
            ': ',
        filter: (value) => __awaiter(this, void 0, void 0, function* () {
            const captainRootDomainFromUser = value.trim();
            try {
                yield CliApiManager_1.default.get(captainMachine).updateRootDomain(captainRootDomainFromUser);
                captainMachine = Utils_1.default.copyObject(captainMachine);
                captainMachine.baseUrl = `http://captain.${captainRootDomainFromUser}`;
            }
            catch (e) {
                StdOutUtil_1.default.errorHandler(e);
            }
            return captainRootDomainFromUser;
        })
    },
    {
        type: 'password',
        name: 'newPasswordFirstTry',
        message: 'Enter a new password:',
        filter: (value) => {
            newPasswordFirstTry = value;
            return value;
        }
    },
    {
        type: 'password',
        name: 'newPassword',
        message: 'Enter your new password again:',
        filter: (value) => __awaiter(this, void 0, void 0, function* () {
            const confirmPasswordValueFromUser = value;
            if (newPasswordFirstTry !== confirmPasswordValueFromUser) {
                StdOutUtil_1.default.printError('Passwords do not match. Try serversetup again.', true);
                throw new Error('Password mismatch');
            }
            return '';
        })
    },
    {
        type: 'input',
        name: 'emailAddress',
        message: "Enter your 'valid' email address to enable HTTPS: ",
        filter: (value) => __awaiter(this, void 0, void 0, function* () {
            const emailAddressFromUser = value.trim();
            let forcedSsl = false;
            try {
                SpinnerHelper_1.default.start('Enabling SSL... Takes a few seconds...');
                yield CliApiManager_1.default.get(captainMachine).enableRootSsl(emailAddressFromUser);
                captainMachine = Utils_1.default.copyObject(captainMachine);
                captainMachine.baseUrl = captainMachine.baseUrl.replace('http://', 'https://');
                yield CliApiManager_1.default.get(captainMachine).forceSsl(true);
                forcedSsl = true;
                yield CliApiManager_1.default.get(captainMachine).changePass(lastWorkingPassword, newPasswordFirstTry);
                lastWorkingPassword = newPasswordFirstTry;
                yield CliApiManager_1.default.get(captainMachine).getAuthToken(lastWorkingPassword);
                SpinnerHelper_1.default.stop();
            }
            catch (e) {
                if (forcedSsl) {
                    StdOutUtil_1.default.printError('Server is setup, but password was not changed due to an error. You cannot use serversetup again.');
                    StdOutUtil_1.default.printError(`Instead, go to ${captainMachine.baseUrl} and change your password on settings page.`);
                    StdOutUtil_1.default.printError(`Then, Use captainduckduck login on your local machine to connect to your server.`);
                }
                SpinnerHelper_1.default.fail();
                StdOutUtil_1.default.errorHandler(e);
            }
            return emailAddressFromUser;
        })
    },
    {
        type: 'input',
        name: 'captainName',
        message: 'Enter a name for this Captain machine:',
        default: CliHelper_1.default.get().findDefaultCaptainName(),
        validate: (value) => {
            const newMachineName = value.trim();
            let errorMessage = undefined;
            if (StorageHelper_1.default.get().findMachine(newMachineName)) {
                return `${newMachineName} already exist. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.`;
            }
            if (CliHelper_1.default.get().isNameValid(newMachineName)) {
                captainMachine.name = newMachineName;
                return true;
            }
            return 'Please enter a valid Captain Name. Small letters, numbers, single hyphen.';
        }
    }
];
function serversetup() {
    return __awaiter(this, void 0, void 0, function* () {
        StdOutUtil_1.default.printMessage('\nSetup your Captain server\n');
        const answersIgnore = yield inquirer.prompt(questions);
        StorageHelper_1.default.get().saveMachine(captainMachine);
        StdOutUtil_1.default.printMessage(`\n\nCaptain is available at ${captainMachine.baseUrl}`);
        StdOutUtil_1.default.printMessage('\nFor more details and docs see http://www.captainduckduck.com\n\n');
    });
}
exports.default = serversetup;
//# sourceMappingURL=serversetup.js.map