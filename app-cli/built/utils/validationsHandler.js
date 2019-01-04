var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const fs = require('fs-extra');
const DeployApi = require('../api/DeployApi');
const { printError } = require('./messageHandler');
const { requestLogin } = require('../commands/login');
const { initMachineFromLocalStorage } = require('../utils/machineUtils');
function validateIsGitRepository() {
    const gitFolderExists = fs.pathExistsSync('./.git');
    if (!gitFolderExists) {
        printError('\n**** ERROR: You are not in a git root directory. This command will only deploys the current directory ****\n', true);
    }
}
function validateDefinitionFile() {
    const captainDefinitionExists = fs.pathExistsSync('./captain-definition');
    if (!captainDefinitionExists) {
        printError('\n**** ERROR: captain-definition file cannot be found. Please see docs! ****\n', true);
    }
    const contents = fs.readFileSync('./captain-definition', 'utf8');
    let contentsJson = null;
    try {
        contentsJson = JSON.parse(contents);
    }
    catch (e) {
        printError(`**** ERROR: captain-definition file is not a valid JSON! ****\n Error:${e}`, true);
    }
    if (contentsJson) {
        if (!contentsJson.schemaVersion) {
            printError('**** ERROR: captain-definition needs schemaVersion. Please see docs! ****', true);
        }
        if (!contentsJson.templateId && !contentsJson.dockerfileLines) {
            printError('**** ERROR: captain-definition needs templateId or dockerfileLines. Please see docs! ****', true);
        }
        if (contentsJson.templateId && contentsJson.dockerfileLines) {
            printError('**** ERROR: captain-definition needs templateId or dockerfileLines, NOT BOTH! Please see docs! ****', true);
        }
    }
}
// Only show that question if there is no option given as argument
function optionIsNotGiven(allOptions, option) {
    // console.log(allOptions)
    if (allOptions[option]) {
        return false;
    }
    return true;
}
function isIpAddress(ipaddress) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
        return true;
    }
    return false;
}
function validateAuthentication() {
    return __awaiter(this, void 0, void 0, function* () {
        // 1. Check if valid auth
        const isAuthenticated = yield DeployApi.isAuthTokenValid();
        // 2. Request login
        // 3. Login
        // 4. Update token
        if (!isAuthenticated) {
            const loggedInStatus = yield requestLogin();
            // Refresh token in DeployApi
            initMachineFromLocalStorage();
            return loggedInStatus;
        }
        else {
            return Boolean(isAuthenticated);
        }
    });
}
module.exports = {
    validateAuthentication,
    validateIsGitRepository,
    validateDefinitionFile,
    isIpAddress,
    optionIsNotGiven
};
//# sourceMappingURL=validationsHandler.js.map