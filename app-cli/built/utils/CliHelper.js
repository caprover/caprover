"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StorageHelper_1 = require("./StorageHelper");
const StdOutUtil_1 = require("./StdOutUtil");
class CliHelper {
    static get() {
        if (!CliHelper.instance)
            CliHelper.instance = new CliHelper();
        return CliHelper.instance;
    }
    getMachinesAsOptions() {
        const machines = StorageHelper_1.default.get().getMachines();
        const firstItemInOption = [
            {
                name: '-- CANCEL --',
                value: '',
                short: ''
            }
        ];
        const listOfMachines = machines.map((machine) => {
            return {
                name: `${machine.name} at ${machine.baseUrl}`,
                value: `${machine.name}`,
                short: `${machine.name} at ${machine.baseUrl}`
            };
        });
        return [...firstItemInOption, ...listOfMachines];
    }
    logoutMachine(machineName) {
        const removedMachine = StorageHelper_1.default.get().removeMachine(machineName);
        StdOutUtil_1.default.printMessage(`You are now logged out from ${removedMachine.name} at ${removedMachine.baseUrl}...\n`);
    }
    findDefaultCaptainName() {
        let currentSuffix = StorageHelper_1.default.get().getMachines().length + 1;
        const self = this;
        while (!self.isSuffixValid(currentSuffix)) {
            currentSuffix++;
        }
        return self.getCaptainFullName(currentSuffix);
    }
    getCaptainFullName(suffix) {
        const formatSuffix = suffix < 10 ? `0${suffix}` : suffix;
        return `captain-${formatSuffix}`;
    }
    isSuffixValid(suffixNumber) {
        const self = this;
        let valid = true;
        StorageHelper_1.default.get().getMachines().map((machine) => {
            if (machine.name === self.getCaptainFullName(suffixNumber)) {
                valid = false;
            }
        });
        return valid;
    }
}
exports.default = CliHelper;
//# sourceMappingURL=CliHelper.js.map