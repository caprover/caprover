"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ConfigStore = require("configstore");
const Utils_1 = require("./Utils");
const CAP_MACHINES = 'CapMachines';
const DEPLOYED_DIRS = 'DeployedDirs';
class StorageHelper {
    static get() {
        if (!StorageHelper.instance)
            StorageHelper.instance = new StorageHelper();
        return StorageHelper.instance;
    }
    constructor() {
        this.data = new ConfigStore('captainduckduck');
        this.migrateData();
    }
    migrateData() {
        const self = this;
        const data = this.data;
        const oldMachines = data.get('captainMachines') || [];
        const oldApps = data.get('apps') || [];
        oldMachines.forEach((m) => {
            self.saveMachine({
                authToken: m.authToken,
                baseUrl: m.baseUrl,
                name: m.name
            });
        });
        oldApps.forEach((app) => {
            self.saveDeployedDirectory({
                appName: app.appName,
                cwd: app.cwd,
                machineNameToDeploy: app.machineToDeploy.name,
                deploySource: {
                    branchToPush: app.branchToPush
                }
            });
        });
        data.delete('captainMachines');
        data.delete('apps');
    }
    getMachines() {
        return Utils_1.default.copyObject(this.data.get(CAP_MACHINES) || []);
    }
    findMachine(machineName) {
        return this.getMachines().find((m) => m.name === machineName);
    }
    removeMachine(machineName) {
        const machines = this.getMachines();
        const removedMachine = machines.filter((machine) => machine.name === machineName)[0];
        const newMachines = machines.filter((machine) => machine.name !== machineName);
        this.data.set(CAP_MACHINES, newMachines);
        return removedMachine;
    }
    saveMachine(machineToSaveOrUpdate) {
        const currMachines = this.getMachines();
        let updatedMachine = false;
        for (let index = 0; index < currMachines.length; index++) {
            const element = currMachines[index];
            if (element.name === machineToSaveOrUpdate.name) {
                updatedMachine = true;
                currMachines[index] = machineToSaveOrUpdate;
                break;
            }
        }
        if (!updatedMachine) {
            currMachines.push(machineToSaveOrUpdate);
        }
        this.data.set(CAP_MACHINES, currMachines);
    }
    getDeployedDirectories() {
        return Utils_1.default.copyObject(this.data.get(DEPLOYED_DIRS) || []);
    }
    saveDeployedDirectory(directoryToSaveOrUpdate) {
        const currDirs = this.getDeployedDirectories();
        let updatedDir = false;
        for (let index = 0; index < currDirs.length; index++) {
            const element = currDirs[index];
            if (element.cwd === directoryToSaveOrUpdate.cwd) {
                updatedDir = true;
                currDirs[index] = directoryToSaveOrUpdate;
                break;
            }
        }
        if (!updatedDir) {
            currDirs.push(directoryToSaveOrUpdate);
        }
        this.data.set(DEPLOYED_DIRS, currDirs);
    }
}
exports.default = StorageHelper;
//# sourceMappingURL=StorageHelper.js.map