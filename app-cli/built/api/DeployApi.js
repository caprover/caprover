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
var MainApi = require("./MainApi");
var MachineHelper = require("../helpers/MachineHelper");
var _a = require("../utils/constants"), DEFAULT_BRANCH_TO_PUSH = _a.DEFAULT_BRANCH_TO_PUSH, DEFAULT_APP_NAME = _a.DEFAULT_APP_NAME;
var DeployApi = /** @class */ (function () {
    function DeployApi() {
        this.machineToDeploy = {};
        this.branchToPush = DEFAULT_BRANCH_TO_PUSH;
        this.appName = DEFAULT_APP_NAME;
        this.appUrl = "";
    }
    DeployApi.prototype.setMachineToDeploy = function (machineToDeploy) {
        this.machineToDeploy = machineToDeploy;
    };
    DeployApi.prototype.updateMachineToDeploy = function (machineToDeploy) {
        var possibleMachine = {};
        // Look machine by host
        if (machineToDeploy.startsWith("http")) {
            possibleMachine = MachineHelper.machines.find(function (machine) { return machine.baseUrl === machineToDeploy; });
        }
        else {
            // Look machine by name
            possibleMachine = MachineHelper.machines.find(function (machine) { return machine.name === machineToDeploy; });
        }
        this.machineToDeploy = possibleMachine;
    };
    DeployApi.prototype.setBranchToPush = function (branchToPush) {
        this.branchToPush = branchToPush;
    };
    DeployApi.prototype.setAppName = function (appName) {
        this.appName = appName;
        this.setAppUrl();
    };
    DeployApi.prototype.setAppUrl = function () {
        this.appUrl = this.machineToDeploy.baseUrl
            .replace("//captain.", "//" + this.appName + ".")
            .replace("https://", "http://");
    };
    DeployApi.prototype.fetchBuildLogs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, authToken, baseUrl, customOptions, data, e_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        _a = this.machineToDeploy, authToken = _a.authToken, baseUrl = _a.baseUrl;
                        customOptions = {
                            headers: {
                                "x-captain-auth": authToken
                            }
                        };
                        return [4 /*yield*/, MainApi.get(baseUrl + "/api/v1/user/appData/" + this.appName, customOptions)];
                    case 1:
                        data = _b.sent();
                        return [2 /*return*/, data];
                    case 2:
                        e_1 = _b.sent();
                        throw e_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    DeployApi.prototype.sendFile = function (sourceFile, gitHash) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, authToken, baseUrl, url, form, options, data, e_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        _a = this.machineToDeploy, authToken = _a.authToken, baseUrl = _a.baseUrl;
                        url = baseUrl + "/api/v1/user/appData/" + this.appName + "/?detached=1";
                        form = {
                            sourceFile: sourceFile,
                            gitHash: gitHash
                        };
                        options = {
                            headers: {
                                "x-captain-auth": authToken
                            }
                        };
                        return [4 /*yield*/, MainApi.postWithFile(url, form, options)];
                    case 1:
                        data = _b.sent();
                        return [2 /*return*/, data];
                    case 2:
                        e_2 = _b.sent();
                        throw e_2;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    // This is not moved to LoginAPI since it's related only for machineToDeploy
    DeployApi.prototype.isAuthTokenValid = function () {
        return __awaiter(this, void 0, void 0, function () {
            var url, currentToken, options, response, data, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        if (!this.machineToDeploy)
                            return [2 /*return*/, false];
                        url = this.machineToDeploy.baseUrl + "/api/v1/user/appDefinitions/";
                        currentToken = this.machineToDeploy.authToken;
                        options = {
                            headers: {
                                "x-captain-auth": currentToken
                            }
                        };
                        return [4 /*yield*/, MainApi.get(url, options)];
                    case 1:
                        response = _a.sent();
                        data = JSON.parse(response);
                        // Tolken is not valid
                        if (data.status === 1106 || data.status === 1105) {
                            return [2 /*return*/, false];
                        }
                        return [2 /*return*/, true];
                    case 2:
                        e_3 = _a.sent();
                        throw e_3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return DeployApi;
}());
module.exports = new DeployApi();
