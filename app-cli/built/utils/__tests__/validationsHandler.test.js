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
var _a = require("../validationsHandler"), validateIsGitRepository = _a.validateIsGitRepository, validateDefinitionFile = _a.validateDefinitionFile, optionIsNotGiven = _a.optionIsNotGiven, isIpAddress = _a.isIpAddress, validateAuthentication = _a.validateAuthentication;
var printError = require("../messageHandler").printError;
var requestLogin = require("../../commands/login").requestLogin;
var initMachineFromLocalStorage = require("../machineUtils").initMachineFromLocalStorage;
jest.mock("fs");
jest.mock("../messageHandler", function () {
    return {
        printError: jest.fn()
    };
});
jest.mock("../../api/DeployApi", function () {
    return {
        isAuthTokenValid: jest.fn(function () { return false; }) // Simulates it's not authenticated
    };
});
jest.mock("../../commands/login", function () {
    return {
        requestLogin: jest.fn()
    };
});
jest.mock("../machineUtils", function () {
    return {
        initMachineFromLocalStorage: jest.fn()
    };
});
describe("Validations handler", function () {
    it("should printError if not on a git repository", function () {
        validateIsGitRepository();
        expect(printError).toHaveBeenCalledTimes(1);
    });
    it("should printError if there is no captain definition file", function () {
        validateDefinitionFile();
        // 2nd time because file was not found
        // 3rd time because it tried to read from a file and was not valid json
        expect(printError).toHaveBeenCalledTimes(3);
    });
    it("should return false if the option is included", function () {
        var options = {
            branch: "master"
        };
        var result = optionIsNotGiven(options, "branch");
        expect(result).toBe(false);
    });
    it("should return true if the option is not given", function () {
        var options = {
            test: "something"
        };
        var result = optionIsNotGiven(options, "branch");
        expect(result).toBe(true);
    });
    it("should be a valid IP Address", function () {
        var validIpAddress = "192.168.1.1";
        var result = isIpAddress(validIpAddress);
        expect(result).toBe(true);
    });
    it("should be an invalid IP Address", function () {
        var validIpAddress = "192.168.1";
        var result = isIpAddress(validIpAddress);
        expect(result).toBe(false);
    });
    it("should promt the login option and initialize from the machine in localstorage", function () { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, validateAuthentication()];
                case 1:
                    _a.sent();
                    expect(requestLogin).toBeCalledTimes(1);
                    expect(initMachineFromLocalStorage).toBeCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
});
