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
const StdOutUtil_1 = require("./StdOutUtil");
const CliApiManager_1 = require("../api/CliApiManager");
const requestLogin_1 = require("../commands/requestLogin");
const fs = require('fs-extra');
function validateIsGitRepository() {
    const gitFolderExists = fs.pathExistsSync('./.git');
    if (!gitFolderExists) {
        StdOutUtil_1.default.printError('\n**** ERROR: You are not in a git root directory. This command will only deploys the current directory ****\n', true);
    }
    return !!gitFolderExists;
}
exports.validateIsGitRepository = validateIsGitRepository;
function validateDefinitionFile() {
    const captainDefinitionExists = fs.pathExistsSync('./captain-definition');
    if (!captainDefinitionExists) {
        StdOutUtil_1.default.printError('\n**** ERROR: captain-definition file cannot be found. Please see docs! ****\n', true);
    }
    else {
        const contents = fs.readFileSync('./captain-definition', 'utf8');
        let contentsJson = null;
        try {
            contentsJson = JSON.parse(contents);
        }
        catch (e) {
            StdOutUtil_1.default.printError(`**** ERROR: captain-definition file is not a valid JSON! ****\n Error:${e}`, true);
        }
        if (contentsJson) {
            if (!contentsJson.schemaVersion) {
                StdOutUtil_1.default.printError('**** ERROR: captain-definition needs schemaVersion. Please see docs! ****', true);
            }
            else if (!contentsJson.templateId && !contentsJson.dockerfileLines) {
                StdOutUtil_1.default.printError('**** ERROR: captain-definition needs templateId or dockerfileLines. Please see docs! ****', true);
            }
            else if (contentsJson.templateId && contentsJson.dockerfileLines) {
                StdOutUtil_1.default.printError('**** ERROR: captain-definition needs templateId or dockerfileLines, NOT BOTH! Please see docs! ****', true);
            }
            else {
                return true;
            }
        }
    }
    return false;
}
exports.validateDefinitionFile = validateDefinitionFile;
function isIpAddress(ipaddress) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
        return true;
    }
    return false;
}
exports.isIpAddress = isIpAddress;
function ensureAuthentication(machine) {
    return __awaiter(this, void 0, void 0, function* () {
        let isAuthenticated = false;
        try {
            let ignoreVal = yield CliApiManager_1.default.get(machine).getAllApps();
            isAuthenticated = true;
        }
        catch (e) {
            // ignore
        }
        if (!isAuthenticated) {
            const loggedInStatus = yield requestLogin_1.default(machine);
        }
    });
}
exports.ensureAuthentication = ensureAuthentication;
//# sourceMappingURL=ValidationsHandler.js.map