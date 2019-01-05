"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ApiManager_1 = require("./ApiManager");
const StorageHelper_1 = require("../utils/StorageHelper");
function hashCode(str) {
    var hash = 0, i, chr;
    if (str.length === 0)
        return hash;
    for (i = 0; i < str.length; i++) {
        chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}
class CliApiManager {
    static get(capMachine) {
        const hashKey = 'v' + hashCode(capMachine.baseUrl);
        if (!CliApiManager.instances[hashKey])
            CliApiManager.instances[hashKey] = new ApiManager_1.default(capMachine.baseUrl + '/api/v1', function (token) {
                capMachine.authToken = token;
                StorageHelper_1.default.get().saveMachine(capMachine);
                return Promise.resolve();
            });
        return CliApiManager.instances[hashKey];
    }
}
CliApiManager.instances = {};
exports.default = CliApiManager;
//# sourceMappingURL=CliApiManager.js.map