#!/usr/bin/env node
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var MachineHelper = require("../helpers/MachineHelper");
var DeployApi = require("../api/DeployApi");
var LoginApi = require("../api/LoginApi");
var _a = require("../utils/messageHandler"), printError = _a.printError, printMessage = _a.printMessage;
var _b = require("../utils/validationsHandler"), validateIsGitRepository = _b.validateIsGitRepository, validateDefinitionFile = _b.validateDefinitionFile, optionIsNotGiven = _b.optionIsNotGiven, validateAuthentication = _b.validateAuthentication;
var uploadFile = require("../utils/fileHelper").uploadFile;
var gitArchiveFile = require("../utils/fileHelper").gitArchiveFile;
var fs = require("fs-extra");
var path = require("path");
var inquirer = require("inquirer");
var commandExistsSync = require("command-exists").sync;
var initMachineFromLocalStorage = require("../utils/machineUtils").initMachineFromLocalStorage;
function deployAsDefaultValues() {
    return __awaiter(this, void 0, void 0, function () {
        var isValidAuthentication, appName, branchToPush, machineToDeploy, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, validateAuthentication()];
                case 1:
                    isValidAuthentication = _a.sent();
                    if (isValidAuthentication) {
                        appName = DeployApi.appName, branchToPush = DeployApi.branchToPush, machineToDeploy = DeployApi.machineToDeploy;
                        if (!appName || !branchToPush || !machineToDeploy) {
                            printError("Default deploy failed. There are no default options selected.", true);
                        }
                        printMessage("Deploying to " + machineToDeploy.name);
                        deployFromGitProject();
                    }
                    else {
                        printError("Incorrect login details", true);
                    }
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    printError(e_1.message, true);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function deployAsStateless(host, appName, branch, pass) {
    return __awaiter(this, void 0, void 0, function () {
        var isStateless, name_1, response, data, newToken;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    isStateless = host && appName && branch && pass;
                    if (!isStateless) return [3 /*break*/, 2];
                    // login first
                    printMessage("Trying to login to " + host + "\n");
                    name_1 = DeployApi.machineToDeploy.name;
                    return [4 /*yield*/, LoginApi.loginMachine(host, pass)];
                case 1:
                    response = _a.sent();
                    data = JSON.parse(response);
                    newToken = data.token;
                    // Update the token to the machine that corresponds (if needed)
                    MachineHelper.updateMachineAuthToken(name_1, newToken);
                    if (data) {
                        printMessage("Starting stateless deploy to\n" + host + "\n" + branch + "\n" + appName);
                        deployFromGitProject();
                    }
                    return [3 /*break*/, 3];
                case 2:
                    printError("You are missing parameters for deploying on stateless. <host> <password> <app name> <branch>");
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function deployFromTarFile(tarFile) {
    return __awaiter(this, void 0, void 0, function () {
        var isValidAuthentication, filePath, gitHash, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, validateAuthentication()];
                case 1:
                    isValidAuthentication = _a.sent();
                    if (!isValidAuthentication) return [3 /*break*/, 3];
                    filePath = tarFile;
                    gitHash = "sendviatarfile";
                    return [4 /*yield*/, uploadFile(filePath, gitHash)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    printError("Incorrect login details", true);
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    e_2 = _a.sent();
                    printError(e_2.message, true);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
function deployFromGitProject() {
    if (!commandExistsSync("git")) {
        printError("'git' command not found...");
        printError("Captain needs 'git' to create tar file of your source files...", true);
    }
    var zipFileNameToDeploy = "temporary-captain-to-deploy.tar";
    var zipFileFullPath = path.join(process.cwd(), zipFileNameToDeploy);
    printMessage("Saving tar file to:\n" + zipFileFullPath + "\n");
    // Removes the temporarly file created
    try {
        var tempFileExists = fs.pathExistsSync(zipFileFullPath);
        if (tempFileExists) {
            fs.removeSync(zipFileFullPath);
        }
    }
    catch (e) {
        // IgnoreError
    }
    gitArchiveFile(zipFileFullPath, DeployApi.branchToPush);
}
function deploy(options) {
    return __awaiter(this, void 0, void 0, function () {
        var questions, answers, captainNameToDeploy, branchToPush, appName, isValidAuthentication, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Reads local storage and sets the machine if found
                    initMachineFromLocalStorage();
                    if (!options.tarFile || !options.stateless) {
                        validateIsGitRepository();
                        validateDefinitionFile();
                    }
                    printMessage("Preparing deployment to Captain...\n");
                    if (!options.default) return [3 /*break*/, 1];
                    deployAsDefaultValues();
                    return [3 /*break*/, 8];
                case 1:
                    if (!options.stateless) return [3 /*break*/, 2];
                    deployAsStateless(options.host, options.appName, options.branch, options.pass);
                    return [3 /*break*/, 8];
                case 2:
                    if (!options.tarFile) return [3 /*break*/, 3];
                    deployFromTarFile(options.tarFile);
                    return [3 /*break*/, 8];
                case 3:
                    questions = [
                        {
                            type: "list",
                            name: "captainNameToDeploy",
                            default: DeployApi.machineToDeploy.name || "",
                            message: "Select the Captain Machine you want to deploy to:",
                            choices: MachineHelper.getMachinesAsOptions(),
                            when: function () { return optionIsNotGiven(options, "host"); }
                        },
                        {
                            type: "input",
                            default: DeployApi.branchToPush || "master",
                            name: "branchToPush",
                            message: "Enter the 'git' branch you would like to deploy:",
                            when: function () { return optionIsNotGiven(options, "branch"); }
                        },
                        {
                            type: "input",
                            default: DeployApi.appName,
                            name: "appName",
                            message: "Enter the Captain app name this directory will be deployed to:",
                            when: function () { return optionIsNotGiven(options, "appName"); }
                        },
                        {
                            type: "confirm",
                            name: "confirmedToDeploy",
                            message: "Note that uncommitted files and files in gitignore (if any) will not be pushed to server. Please confirm so that deployment process can start.",
                            default: true,
                            when: function () { return optionIsNotGiven(options, "stateless"); }
                        }
                    ];
                    return [4 /*yield*/, inquirer.prompt(questions)];
                case 4:
                    answers = _a.sent();
                    if (!answers.confirmedToDeploy && !options.stateless) {
                        printMessage("\nOperation cancelled by the user...\n");
                        process.exit(0);
                    }
                    captainNameToDeploy = answers.captainNameToDeploy;
                    branchToPush = answers.branchToPush || options.branch;
                    appName = answers.appName || options.appName;
                    DeployApi.updateMachineToDeploy(captainNameToDeploy || options.host);
                    DeployApi.setBranchToPush(branchToPush);
                    DeployApi.setAppName(appName);
                    printMessage("Deploying to " + DeployApi.machineToDeploy.name);
                    if (!answers.confirmedToDeploy) return [3 /*break*/, 8];
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, validateAuthentication()];
                case 6:
                    isValidAuthentication = _a.sent();
                    if (isValidAuthentication) {
                        deployFromGitProject();
                    }
                    else {
                        printError("Incorrect login details", true);
                    }
                    return [3 /*break*/, 8];
                case 7:
                    e_3 = _a.sent();
                    printError(e_3.message, true);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
module.exports = deploy;
