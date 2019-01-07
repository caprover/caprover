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
const CliApiManager_1 = require("../api/CliApiManager");
function deploy(options) {
    return __awaiter(this, void 0, void 0, function* () {
        const possibleApp = StorageHelper_1.default.get()
            .getDeployedDirectories()
            .find((dir) => dir.cwd === process.cwd());
        StdOutUtil_1.default.printMessage('Preparing deployment to Captain...\n');
        let deployParams = { deploySource: {} };
        if (options.default) {
            deployParams = {
                captainMachine: possibleApp ? StorageHelper_1.default.get().findMachine(possibleApp.machineNameToDeploy) : undefined,
                deploySource: possibleApp ? possibleApp.deploySource : {},
                appName: possibleApp ? possibleApp.appName : undefined
            };
        }
        else if (possibleApp) {
            StdOutUtil_1.default.printMessage(`\n\n**********\n\nProtip: You seem to have deployed ${possibleApp.appName} from this directory in the past, use --default flag to avoid having to re-enter the information.\n\n**********\n\n`);
        }
        if (options.appName) {
            deployParams.appName = options.appName;
        }
        if (options.branch) {
            deployParams.deploySource.branchToPush = options.branch;
        }
        if (options.tarFile) {
            deployParams.deploySource.tarFilePath = options.tarFile;
        }
        if (!deployParams.deploySource.tarFilePath) {
            if (!ValidationsHandler_1.validateIsGitRepository() || !ValidationsHandler_1.validateDefinitionFile()) {
                return;
            }
        }
        if (options.pass || options.host) {
            if (options.pass && options.host) {
                deployParams.captainMachine = {
                    authToken: '',
                    baseUrl: options.host,
                    name: ''
                };
                yield CliApiManager_1.default.get(deployParams.captainMachine).getAuthToken(options.pass);
            }
            else {
                StdOutUtil_1.default.printError('host and pass should be either both defined or both undefined', true);
                return;
            }
        }
        // Show questions for what is being missing in deploy params
        let allApps = undefined;
        if (deployParams.captainMachine) {
            allApps = yield ValidationsHandler_1.ensureAuthentication(deployParams.captainMachine);
        }
        const allParametersAreSupplied = !!deployParams.appName &&
            !!deployParams.captainMachine &&
            (!!deployParams.deploySource.branchToPush || !!deployParams.deploySource.tarFilePath);
        if (!allParametersAreSupplied) {
            const questions = [
                {
                    type: 'list',
                    name: 'captainNameToDeploy',
                    default: possibleApp ? possibleApp.machineNameToDeploy : '',
                    message: 'Select the Captain Machine you want to deploy to:',
                    choices: CliHelper_1.default.get().getMachinesAsOptions(),
                    when: () => !deployParams.captainMachine,
                    filter: (capName) => __awaiter(this, void 0, void 0, function* () {
                        deployParams.captainMachine = StorageHelper_1.default.get().findMachine(capName);
                        if (deployParams.captainMachine)
                            allApps = yield ValidationsHandler_1.ensureAuthentication(deployParams.captainMachine);
                        return capName;
                    })
                },
                {
                    type: 'input',
                    default: possibleApp && possibleApp.deploySource.branchToPush
                        ? possibleApp.deploySource.branchToPush
                        : 'master',
                    name: 'branchToPush',
                    message: "Enter the 'git' branch you would like to deploy:",
                    filter: (branchToPushEntered) => __awaiter(this, void 0, void 0, function* () {
                        deployParams.deploySource.branchToPush = branchToPushEntered;
                        return branchToPushEntered;
                    }),
                    when: (answers) => !deployParams.deploySource.branchToPush &&
                        !deployParams.deploySource.tarFilePath &&
                        !!deployParams.captainMachine
                },
                {
                    type: 'list',
                    default: possibleApp ? possibleApp.appName : '',
                    name: 'appName',
                    message: 'Enter the Captain app name this directory will be deployed to:',
                    choices: (answers) => {
                        return CliHelper_1.default.get().getAppsAsOptions(allApps);
                    },
                    filter: (appNameEntered) => __awaiter(this, void 0, void 0, function* () {
                        deployParams.appName = appNameEntered;
                        return appNameEntered;
                    }),
                    when: (answers) => (!!deployParams.deploySource.branchToPush || !!deployParams.deploySource.tarFilePath) &&
                        !deployParams.appName
                },
                {
                    type: 'confirm',
                    name: 'confirmedToDeploy',
                    message: 'Note that uncommitted files and files in gitignore (if any) will not be pushed to server. \n  Please confirm so that deployment process can start.',
                    default: true,
                    when: (answers) => !!deployParams.appName &&
                        !!deployParams.captainMachine &&
                        (!!deployParams.deploySource.branchToPush || !!deployParams.deploySource.tarFilePath)
                }
            ];
            const answersToIgnore = (yield inquirer.prompt(questions));
            if (!answersToIgnore.confirmedToDeploy) {
                StdOutUtil_1.default.printMessage('\nOperation cancelled by the user...\n');
                process.exit(0);
                return;
            }
        }
        try {
            yield new DeployHelper_1.default(deployParams) //
                .startDeploy();
        }
        catch (e) {
            StdOutUtil_1.default.printError(e.message, true);
        }
    });
}
exports.default = deploy;
//# sourceMappingURL=deploy.js.map