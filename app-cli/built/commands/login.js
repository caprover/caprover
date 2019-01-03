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
var _a = require("../utils/messageHandler"), printMessage = _a.printMessage, printGreenMessage = _a.printGreenMessage, printError = _a.printError;
var inquirer = require("inquirer");
var DeployApi = require("../api/DeployApi");
var _b = require("../utils/loginHelpers"), cleanUpUrl = _b.cleanUpUrl, findDefaultCaptainName = _b.findDefaultCaptainName;
var SAMPLE_DOMAIN = require("../utils/constants").SAMPLE_DOMAIN;
var LoginApi = require("../api/LoginApi");
// In case the token is expired
function requestLogin() {
    return __awaiter(this, void 0, void 0, function () {
        var _a, baseUrl, name, questions, loginPassword, password, response, data, newToken;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = DeployApi.machineToDeploy, baseUrl = _a.baseUrl, name = _a.name;
                    printMessage("Your auth token is not valid anymore. Try to login again.");
                    questions = [
                        {
                            type: "password",
                            name: "captainPassword",
                            message: "Please enter your password for " + baseUrl,
                            validate: function (value) {
                                if (value && value.trim()) {
                                    return true;
                                }
                                return "Please enter your password for " + baseUrl;
                            }
                        }
                    ];
                    return [4 /*yield*/, inquirer.prompt(questions)];
                case 1:
                    loginPassword = _b.sent();
                    password = loginPassword.captainPassword;
                    return [4 /*yield*/, LoginApi.loginMachine(baseUrl, password)];
                case 2:
                    response = _b.sent();
                    data = JSON.parse(response);
                    newToken = data.token;
                    if (!newToken)
                        return [2 /*return*/, false
                            // Update the token to the machine that corresponds
                        ];
                    // Update the token to the machine that corresponds
                    MachineHelper.updateMachineAuthToken(name, newToken);
                    return [2 /*return*/, true];
            }
        });
    });
}
function login() {
    return __awaiter(this, void 0, void 0, function () {
        var questions, answers, captainHasRootSsl, captainPassword, captainAddress, captainName, handleHttp, baseUrl, data, response, newMachine, error_1, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    printMessage("Login to a Captain Machine");
                    questions = [
                        {
                            type: "input",
                            default: SAMPLE_DOMAIN,
                            name: "captainAddress",
                            message: "\nEnter address of the Captain machine. \nIt is captain.[your-captain-root-domain] :",
                            validate: function (value) {
                                if (value === SAMPLE_DOMAIN) {
                                    return "Enter a valid URL";
                                }
                                if (!cleanUpUrl(value))
                                    return "This is an invalid URL: " + value;
                                MachineHelper.machines.map(function (machine) {
                                    if (cleanUpUrl(machine.baseUrl) === cleanUpUrl(value)) {
                                        return value + " already exist as " + machine.name + ". If you want to replace the existing entry, you have to first use <logout> command, and then re-login.";
                                    }
                                });
                                if (value && value.trim()) {
                                    return true;
                                }
                                return "Please enter a valid address.";
                            }
                        },
                        {
                            type: "confirm",
                            name: "captainHasRootSsl",
                            message: "Is HTTPS activated for this Captain machine?",
                            default: true
                        },
                        {
                            type: "password",
                            name: "captainPassword",
                            message: "Enter your password:",
                            validate: function (value) {
                                if (value && value.trim()) {
                                    return true;
                                }
                                return "Please enter your password.";
                            }
                        },
                        {
                            type: "input",
                            name: "captainName",
                            message: "Enter a name for this Captain machine:",
                            default: findDefaultCaptainName(),
                            validate: function (value) {
                                MachineHelper.machines.map(function (machine) {
                                    if (machine.name === value) {
                                        return value + " already exist. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.";
                                    }
                                });
                                if (value.match(/^[-\d\w]+$/i)) {
                                    return true;
                                }
                                return "Please enter a Captain Name.";
                            }
                        }
                    ];
                    return [4 /*yield*/, inquirer.prompt(questions)];
                case 1:
                    answers = _a.sent();
                    captainHasRootSsl = answers.captainHasRootSsl, captainPassword = answers.captainPassword, captainAddress = answers.captainAddress, captainName = answers.captainName;
                    handleHttp = captainHasRootSsl ? "https://" : "http://";
                    baseUrl = "" + handleHttp + cleanUpUrl(captainAddress);
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, LoginApi.loginMachine(baseUrl, captainPassword)];
                case 3:
                    data = _a.sent();
                    response = JSON.parse(data);
                    // TODO - This status should be 200 maybe?
                    if (response.status !== 100) {
                        throw new Error(JSON.stringify(response, null, 2));
                    }
                    newMachine = {
                        authToken: response.token,
                        baseUrl: baseUrl,
                        name: captainName
                    };
                    MachineHelper.addMachine(newMachine);
                    printGreenMessage("Logged in successfully to " + baseUrl);
                    printGreenMessage("Authorization token is now saved as " + captainName + " \n");
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    errorMessage = error_1.message ? error_1.message : error_1;
                    printError("Something bad happened. Cannot save \"" + captainName + "\" \n" + errorMessage);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
module.exports = { login: login, requestLogin: requestLogin };
