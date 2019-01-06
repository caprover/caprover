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
const ValidationsHandler_1 = require("../utils/ValidationsHandler");
const StorageHelper_1 = require("../utils/StorageHelper");
const CliHelper_1 = require("../utils/CliHelper");
const DeployHelper_1 = require("../utils/DeployHelper");
// async function deployAsStateless(host: string, appName: string, branch: string, pass: string) {
// 	const isStateless = host && appName && branch && pass;
// 	if (isStateless) {
// 		// login first
// 		StdOutUtil.printMessage(`Trying to login to ${host}\n`);
// 		const { name } = DeployApi.machineToDeploy;
// 		const response = await LoginApi.loginMachine(host, pass);
// 		const data = JSON.parse(response);
// 		const newToken = data.token;
// 		// Update the token to the machine that corresponds (if needed)
// 		MachineHelper.updateMachineAuthToken(name, newToken);
// 		if (data) {
// 			StdOutUtil.printMessage(`Starting stateless deploy to\n${host}\n${branch}\n${appName}`);
// 			deployFromGitProject();
// 		}
// 	} else {
// 		StdOutUtil.printError(
// 			'You are missing parameters for deploying on stateless. <host> <password> <app name> <branch>'
// 		);
// 	}
// }
// async function deployFromTarFile(tarFile: string) {
// 	try {
// 		const isValidAuthentication = await validateAuthentication();
// 		if (isValidAuthentication) {
// 			// Send from tar file
// 			const filePath = tarFile;
// 			const gitHash = 'sendviatarfile';
// 			await uploadFile(filePath, gitHash);
// 		} else {
// 			StdOutUtil.printError('Incorrect login details', true);
// 		}
// 	} catch (e) {
// 		StdOutUtil.printError(e.message, true);
// 	}
// }
function deploy(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const possibleApp = StorageHelper_1.default.get()
            .getDeployedDirectories()
            .find((dir) => dir.cwd === process.cwd());
        if (!options.tarFile) {
            if (!ValidationsHandler_1.validateIsGitRepository() || !ValidationsHandler_1.validateDefinitionFile()) {
                return;
            }
        }
        StdOutUtil_1.default.printMessage('Preparing deployment to Captain...\n');
        let deployParams = possibleApp
            ? {
                captainNameToDeploy: possibleApp.machineNameToDeploy,
                branchToPush: possibleApp.branchToPush,
                appName: possibleApp.appName
            }
            : {};
        if (options.default) {
            //deployAsDefaultValues();
            //}
            // else if (options.stateless) {
            // 	deployAsStateless(options.host, options.appName, options.branch, options.pass);
            // }
            // else if (options.tarFile) {
            // 	deployFromTarFile(options.tarFile);
        }
        else {
            const questions = [
                {
                    type: 'list',
                    name: 'captainNameToDeploy',
                    default: possibleApp ? possibleApp.machineNameToDeploy : '',
                    message: 'Select the Captain Machine you want to deploy to:',
                    choices: CliHelper_1.default.get().getMachinesAsOptions()
                },
                {
                    type: 'input',
                    default: possibleApp ? possibleApp.branchToPush : 'master',
                    name: 'branchToPush',
                    message: "Enter the 'git' branch you would like to deploy:",
                    when: (answers) => !!answers.captainNameToDeploy
                },
                {
                    type: 'input',
                    default: possibleApp ? possibleApp.appName : '',
                    name: 'appName',
                    message: 'Enter the Captain app name this directory will be deployed to:',
                    when: (answers) => !!answers.branchToPush
                },
                {
                    type: 'confirm',
                    name: 'confirmedToDeploy',
                    message: 'Note that uncommitted files and files in gitignore (if any) will not be pushed to server. Please confirm so that deployment process can start.',
                    default: true,
                    when: (answers) => !!answers.appName
                }
            ];
            const answers = (yield inquirer.prompt(questions));
            if (!answers.confirmedToDeploy) {
                StdOutUtil_1.default.printMessage('\nOperation cancelled by the user...\n');
                process.exit(0);
                return;
            }
            deployParams = answers;
        }
        const branchToPush = deployParams.branchToPush;
        const appName = deployParams.appName;
        const capMachine = StorageHelper_1.default.get()
            .getMachines()
            .find((machine) => machine.name === deployParams.captainNameToDeploy);
        try {
            yield new DeployHelper_1.default(capMachine, appName, branchToPush) //
                .deployFromGitProject();
        }
        catch (e) {
            StdOutUtil_1.default.printError(e.message, true);
        }
    });
}
exports.default = deploy;
//# sourceMappingURL=deploy.js.map