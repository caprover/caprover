"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { printMessage } = require('../utils/messageHandler');
const configstore = require('configstore');
const packagejson = require('../../package.json');
const configs = new configstore(packagejson.name, {
    captainMachines: []
});
class MachineHelper {
    constructor() {
        this.machines = configs.get('captainMachines');
        this.apps = configs.get('apps');
    }
    getMachinesAsOptions() {
        const firstItemInOption = [
            {
                name: '-- CANCEL --',
                value: '',
                short: ''
            }
        ];
        const listOfMachines = this.machines.map((machine) => {
            return {
                name: `${machine.name} at ${machine.baseUrl}`,
                value: `${machine.name}`,
                short: `${machine.name} at ${machine.baseUrl}`
            };
        });
        return [...firstItemInOption, ...listOfMachines];
    }
    getMachines() {
        return this.machines;
    }
    setMachines(newMachines) {
        this.machines = newMachines;
        configs.set('captainMachines', newMachines);
    }
    updateMachineAuthToken(machineName, authToken) {
        let updatedMachine;
        const newMachines = this.machines.map((machine) => {
            if (machine.name === machineName) {
                updatedMachine = Object.assign({}, machine, { authToken });
                return updatedMachine;
            }
            return machine;
        });
        this.setMachines(newMachines);
        this.updateAppsAuthToken(updatedMachine);
    }
    updateAppsAuthToken(updatedMachine) {
        if (!updatedMachine)
            return;
        const newApps = this.apps.map((app) => {
            if (app.machineToDeploy.name === updatedMachine.name) {
                return Object.assign({}, app, { machineToDeploy: updatedMachine });
            }
            return app;
        });
        this.setApps(newApps);
    }
    setApps(newApps) {
        this.apps = newApps;
        configs.set('apps', newApps);
    }
    addMachine(newMachine) {
        const tempMachines = this.machines;
        const newMachines = [...tempMachines, newMachine];
        // Add to local storage
        configs.set('captainMachines', newMachines);
        this.setMachines(configs.get('captainMachines'));
    }
    logoutMachine(machineName) {
        const removedMachine = this.machines.filter((machine) => machine.name === machineName)[0];
        const newMachines = this.machines.filter((machine) => machine.name !== machineName);
        this.setMachines(newMachines);
        printMessage(`You are now logged out from ${removedMachine.name} at ${removedMachine.baseUrl}...\n`);
    }
}
const instance = new MachineHelper();
exports.default = instance;
//# sourceMappingURL=MachineHelper.js.map