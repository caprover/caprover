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
var _this = this;
var MachineHelper = require("../helpers/MachineHelper");
var SystemApi = require("../api/SystemApi");
var LoginApi = require("../api/LoginApi");
var inquirer = require("inquirer");
var findDefaultCaptainName = require("../utils/loginHelpers").findDefaultCaptainName;
var isIpAddress = require("../utils/validationsHandler").isIpAddress;
var _a = require("../utils/constants"), SAMPLE_IP = _a.SAMPLE_IP, DEFAULT_PASSWORD = _a.DEFAULT_PASSWORD;
var _b = require("../utils/messageHandler"), printMessage = _b.printMessage, printError = _b.printError, printMessageAndExit = _b.printMessageAndExit, errorHandler = _b.errorHandler;
var newPasswordFirstTry = undefined;
var questions = [
    {
        type: "list",
        name: "hasInstalledCaptain",
        message: "Have you already installed Captain on your server by running the following line:" +
            "\nmkdir /captain && docker run -p 80:80 -p 443:443 -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck ?",
        default: "Yes",
        choices: ["Yes", "No"],
        filter: function (value) {
            var answerFromUser = value.trim();
            if (answerFromUser === "Yes")
                return answerFromUser;
            printMessage("\n\nCannot start the setup process if Captain is not installed.");
            printMessageAndExit("Please read tutorial on CaptainDuckDuck.com to learn how to install CaptainDuckDuck on a server.");
        }
    },
    {
        type: "input",
        default: SAMPLE_IP,
        name: "captainAddress",
        message: "Enter IP address of your captain server:",
        filter: function (value) { return __awaiter(_this, void 0, void 0, function () {
            var ipFromUser, data, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ipFromUser = value.trim();
                        if (ipFromUser === SAMPLE_IP || !isIpAddress(ipFromUser)) {
                            printError("\nThis is an invalid IP Address: " + ipFromUser, true);
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, LoginApi.loginMachine("http://" + ipFromUser + ":3000", DEFAULT_PASSWORD)];
                    case 2:
                        data = _a.sent();
                        SystemApi.setIpAddressOfServer(ipFromUser);
                        // All went well
                        if (data)
                            return [2 /*return*/, ipFromUser];
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _a.sent();
                        errorHandler(e_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); }
    },
    {
        type: "password",
        name: "captainOriginalPassword",
        message: "Enter your current password:",
        when: function () { return !LoginApi.token; },
        filter: function (value) { return __awaiter(_this, void 0, void 0, function () {
            var captainPasswordFromUser, data, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        captainPasswordFromUser = value.trim();
                        return [4 /*yield*/, LoginApi.loginMachine("http://" + SystemApi.ipAddressOfServer + ":3000", captainPasswordFromUser)];
                    case 1:
                        data = _a.sent();
                        if (data) {
                            SystemApi.setIpAddressOfServer(captainPasswordFromUser);
                            LoginApi.setOldPassword(captainPasswordFromUser);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        e_2 = _a.sent();
                        errorHandler(e_2);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }
    },
    {
        type: "input",
        name: "captainRootDomain",
        message: "Enter a root domain for this Captain server. For example, enter test.yourdomain.com if you" +
            " setup your DNS to point *.test.yourdomain.com to ip address of your server" +
            ": ",
        filter: function (value) { return __awaiter(_this, void 0, void 0, function () {
            var captainRootDomainFromUser, data, newCustomDomainFromUser, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        captainRootDomainFromUser = value.trim();
                        return [4 /*yield*/, SystemApi.setCustomDomain("http://" + SystemApi.ipAddressOfServer + ":3000", captainRootDomainFromUser)];
                    case 1:
                        data = _a.sent();
                        if (data) {
                            newCustomDomainFromUser = "captain." + captainRootDomainFromUser;
                            SystemApi.setCustomDomainFromUser(newCustomDomainFromUser);
                            return [2 /*return*/, captainRootDomainFromUser];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        e_3 = _a.sent();
                        errorHandler(e_3);
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }
    },
    {
        type: "input",
        name: "emailAddress",
        message: "Enter your 'valid' email address to enable HTTPS: ",
        filter: function (value) { return __awaiter(_this, void 0, void 0, function () {
            var emailAddressFromUser, customDomainFromUser, data, e_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        emailAddressFromUser = value.trim();
                        customDomainFromUser = SystemApi.customDomainFromUser;
                        return [4 /*yield*/, SystemApi.enableHttps("http://" + customDomainFromUser, emailAddressFromUser)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, SystemApi.forceHttps("https://" + customDomainFromUser)];
                    case 2:
                        data = _a.sent();
                        if (data)
                            return [2 /*return*/, emailAddressFromUser];
                        return [3 /*break*/, 4];
                    case 3:
                        e_4 = _a.sent();
                        errorHandler(e_4);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        }); }
    },
    {
        type: "password",
        name: "newPasswordFirstTry",
        message: "Enter a new password:",
        filter: function (value) {
            newPasswordFirstTry = value;
            return value;
        }
    },
    {
        type: "password",
        name: "newPassword",
        message: "Enter a new password:",
        filter: function (value) { return __awaiter(_this, void 0, void 0, function () {
            var customDomainFromUser, confirmPasswordValueFromUser, machineUrl, changePassData, loginData, e_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        customDomainFromUser = SystemApi.customDomainFromUser;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        confirmPasswordValueFromUser = value;
                        machineUrl = "https://" + customDomainFromUser;
                        if (newPasswordFirstTry !== confirmPasswordValueFromUser) {
                            printError("Passwords do not match", true);
                        }
                        return [4 /*yield*/, LoginApi.changePass(machineUrl, confirmPasswordValueFromUser)];
                    case 2:
                        changePassData = _a.sent();
                        if (!changePassData) return [3 /*break*/, 4];
                        return [4 /*yield*/, LoginApi.login(machineUrl, confirmPasswordValueFromUser)];
                    case 3:
                        loginData = _a.sent();
                        if (loginData)
                            return [2 /*return*/];
                        _a.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        e_5 = _a.sent();
                        printError("\nIMPORTANT!! Server setup is completed by password is not changed.");
                        printError("\nYou CANNOT use serversetup anymore. To continue:");
                        printError("\n- Go to https://" + customDomainFromUser + " login with default password and change the password in settings.");
                        printError("\n- In terminal (here), type captainduckduck login and enter this as your root domain: " + customDomainFromUser, true);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        }); }
    },
    {
        type: "input",
        name: "captainName",
        message: "Enter a name for this Captain machine:",
        default: findDefaultCaptainName(),
        validate: function (value) {
            var newMachineName = value.trim();
            MachineHelper.machines.map(function (machine) {
                return machine.name === newMachineName &&
                    newMachineName + " already exist. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.";
            });
            if (value.match(/^[-\d\w]+$/i)) {
                return true;
            }
            return "Please enter a Captain Name.";
        }
    }
];
function serversetup() {
    return __awaiter(this, void 0, void 0, function () {
        var answers, captainAddress, newMachine;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    printMessage("\nSetup your Captain server\n");
                    return [4 /*yield*/, inquirer.prompt(questions)];
                case 1:
                    answers = _a.sent();
                    captainAddress = "https://" + SystemApi.customDomainFromUser;
                    newMachine = {
                        authToken: LoginApi.token,
                        baseUrl: captainAddress,
                        name: answers.captainName
                    };
                    MachineHelper.addMachine(newMachine);
                    printMessage("\n\nCaptain is available at " + captainAddress);
                    printMessage("\nFor more details and docs see http://www.captainduckduck.com\n\n");
                    return [2 /*return*/];
            }
        });
    });
}
module.exports = serversetup;
