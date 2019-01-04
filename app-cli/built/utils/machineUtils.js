"use strict";
const DeployApi = require('../api/DeployApi');
const MachineHelper_1 = require("../helpers/MachineHelper");
function initMachineFromLocalStorage() {
    const possibleApp = MachineHelper_1.default.getApps().find((app) => app.cwd === process.cwd());
    if (possibleApp) {
        DeployApi.setMachineToDeploy(possibleApp.machineToDeploy);
        DeployApi.setAppName(possibleApp.appName);
        DeployApi.setBranchToPush(possibleApp.branchToPush);
    }
}
// Saves the app directory into local storage
function saveMachineToLocalStorage() {
    const apps = MachineHelper_1.default.getApps();
    const currentDirectory = process.cwd();
    let appExists = false;
    // Update app
    const updatedApps = apps.map((app) => {
        if (app.cwd === currentDirectory) {
            appExists = true;
            return {
                cwd: app.cwd,
                appName: DeployApi.appName,
                branchToPush: DeployApi.branchToPush,
                machineToDeploy: DeployApi.machineToDeploy
            };
        }
        return app;
    });
    MachineHelper_1.default.setApps(updatedApps);
    if (!appExists) {
        const newApp = {
            cwd: process.cwd(),
            appName: DeployApi.appName,
            branchToPush: DeployApi.branchToPush,
            machineToDeploy: DeployApi.machineToDeploy
        };
        updatedApps.push(newApp);
        MachineHelper_1.default.setApps(apps);
    }
}
module.exports = {
    initMachineFromLocalStorage,
    saveMachineToLocalStorage
};
//# sourceMappingURL=machineUtils.js.map