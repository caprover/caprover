var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const MainApi = require("./MainApi");
const MachineHelper = require("../helpers/MachineHelper");
const { DEFAULT_BRANCH_TO_PUSH, DEFAULT_APP_NAME } = require("../utils/constants");
class DeployApi {
    constructor() {
        this.machineToDeploy = {};
        this.branchToPush = DEFAULT_BRANCH_TO_PUSH;
        this.appName = DEFAULT_APP_NAME;
        this.appUrl = "";
    }
    setMachineToDeploy(machineToDeploy) {
        this.machineToDeploy = machineToDeploy;
    }
    updateMachineToDeploy(machineToDeploy) {
        let possibleMachine = {};
        // Look machine by host
        if (machineToDeploy.startsWith("http")) {
            possibleMachine = MachineHelper.machines.find(machine => machine.baseUrl === machineToDeploy);
        }
        else {
            // Look machine by name
            possibleMachine = MachineHelper.machines.find(machine => machine.name === machineToDeploy);
        }
        this.machineToDeploy = possibleMachine;
    }
    setBranchToPush(branchToPush) {
        this.branchToPush = branchToPush;
    }
    setAppName(appName) {
        this.appName = appName;
        this.setAppUrl();
    }
    setAppUrl() {
        this.appUrl = this.machineToDeploy.baseUrl
            .replace("//captain.", "//" + this.appName + ".")
            .replace("https://", "http://");
    }
    fetchBuildLogs() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { authToken, baseUrl } = this.machineToDeploy;
                const customOptions = {
                    headers: {
                        "x-captain-auth": authToken
                    }
                };
                const data = yield MainApi.get(`${baseUrl}/api/v1/user/appData/${this.appName}`, customOptions);
                return data;
            }
            catch (e) {
                throw e;
            }
        });
    }
    sendFile(sourceFile, gitHash) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { authToken, baseUrl } = this.machineToDeploy;
                const url = `${baseUrl}/api/v1/user/appData/${this.appName}/?detached=1`;
                const form = {
                    sourceFile,
                    gitHash
                };
                const options = {
                    headers: {
                        "x-captain-auth": authToken
                    }
                };
                const data = yield MainApi.postWithFile(url, form, options);
                return data;
            }
            catch (e) {
                throw e;
            }
        });
    }
    // This is not moved to LoginAPI since it's related only for machineToDeploy
    isAuthTokenValid() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.machineToDeploy)
                    return false;
                const url = `${this.machineToDeploy.baseUrl}/api/v1/user/appDefinitions/`;
                const currentToken = this.machineToDeploy.authToken;
                const options = {
                    headers: {
                        "x-captain-auth": currentToken
                    }
                };
                const response = yield MainApi.get(url, options);
                const data = JSON.parse(response);
                // Tolken is not valid
                if (data.status === 1106 || data.status === 1105) {
                    return false;
                }
                return true;
            }
            catch (e) {
                throw e;
            }
        });
    }
}
module.exports = new DeployApi();
//# sourceMappingURL=DeployApi.js.map