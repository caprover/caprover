var DeployApi = require("../api/DeployApi");
var MachineHelper = require("../helpers/MachineHelper");
function initMachineFromLocalStorage() {
    var possibleApp = MachineHelper.apps.find(function (app) { return app.cwd === process.cwd(); });
    if (possibleApp) {
        DeployApi.setMachineToDeploy(possibleApp.machineToDeploy);
        DeployApi.setAppName(possibleApp.appName);
        DeployApi.setBranchToPush(possibleApp.branchToPush);
    }
}
// Saves the app directory into local storage
function saveMachineToLocalStorage() {
    var apps = MachineHelper.apps;
    var currentDirectory = process.cwd();
    var appExists = false;
    // Update app
    var updatedApps = apps.map(function (app) {
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
    MachineHelper.setApps(updatedApps);
    if (!appExists) {
        var newApp = {
            cwd: process.cwd(),
            appName: DeployApi.appName,
            branchToPush: DeployApi.branchToPush,
            machineToDeploy: DeployApi.machineToDeploy
        };
        updatedApps.push(newApp);
        MachineHelper.setApps(apps);
    }
}
module.exports = {
    initMachineFromLocalStorage: initMachineFromLocalStorage,
    saveMachineToLocalStorage: saveMachineToLocalStorage
};
