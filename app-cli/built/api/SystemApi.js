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
var LoginApi = require("./LoginApi");
// const spinnerUtil = require("../../utils/spinner")
var SystemApi = /** @class */ (function () {
    function SystemApi() {
        this.ipAddressOfServer = "";
        this.customDomainFromUser = "";
        this.newPasswordFirstTry = "";
    }
    SystemApi.prototype.setCustomDomainFromUser = function (newCustomDomainFromUser) {
        this.customDomainFromUser = newCustomDomainFromUser;
    };
    SystemApi.prototype.setIpAddressOfServer = function (newIpAddress) {
        this.ipAddressOfServer = newIpAddress.trim();
    };
    SystemApi.prototype.setCustomDomain = function (baseUrl, rootDomain) {
        return __awaiter(this, void 0, void 0, function () {
            var customOptions, data, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        customOptions = {
                            headers: {
                                "x-captain-auth": LoginApi.token
                            }
                        };
                        return [4 /*yield*/, MainApi.post(baseUrl + "/api/v1/user/system/changerootdomain/", {
                                rootDomain: rootDomain
                            }, customOptions)];
                    case 1:
                        data = _a.sent();
                        return [2 /*return*/, data];
                    case 2:
                        e_1 = _a.sent();
                        throw e_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SystemApi.prototype.enableHttps = function (baseUrl, emailAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var customOptions, data, e_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        customOptions = {
                            headers: {
                                "x-captain-auth": LoginApi.token
                            }
                        };
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, MainApi.post(baseUrl + "/api/v1/user/system/enablessl/", {
                                emailAddress: emailAddress
                            }, customOptions)];
                    case 2:
                        data = _a.sent();
                        return [2 /*return*/, data];
                    case 3:
                        e_2 = _a.sent();
                        throw e_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    SystemApi.prototype.forceHttps = function (baseUrl, isEnabled) {
        if (isEnabled === void 0) { isEnabled = true; }
        return __awaiter(this, void 0, void 0, function () {
            var customOptions, data, e_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        customOptions = {
                            headers: {
                                "x-captain-auth": LoginApi.token
                            }
                        };
                        return [4 /*yield*/, MainApi.post(baseUrl + "/api/v1/user/system/forcessl/", {
                                isEnabled: isEnabled
                            }, customOptions)];
                    case 1:
                        data = _a.sent();
                        return [2 /*return*/, data];
                    case 2:
                        e_3 = _a.sent();
                        throw e_3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return SystemApi;
}());
module.exports = new SystemApi();
