var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var printMessage = require("../utils/messageHandler").printMessage;
var configstore = require("configstore");
var packagejson = require("../../package.json");
var configs = new configstore(packagejson.name, {
    captainMachines: []
});
var MachineHelper = /** @class */ (function () {
    function MachineHelper() {
        this.machines = configs.get("captainMachines");
        this.apps = configs.get("apps");
    }
    MachineHelper.prototype.getMachinesAsOptions = function () {
        var firstItemInOption = [
            {
                name: "-- CANCEL --",
                value: "",
                short: ""
            }
        ];
        var listOfMachines = this.machines.map(function (machine) {
            return {
                name: machine.name + " at " + machine.baseUrl,
                value: "" + machine.name,
                short: machine.name + " at " + machine.baseUrl
            };
        });
        return firstItemInOption.concat(listOfMachines);
    };
    MachineHelper.prototype.setMachines = function (newMachines) {
        this.machines = newMachines;
        configs.set("captainMachines", newMachines);
    };
    MachineHelper.prototype.updateMachineAuthToken = function (machineName, authToken) {
        var updatedMachine = {};
        var newMachines = this.machines.map(function (machine) {
            if (machine.name === machineName) {
                updatedMachine = __assign({}, machine, { authToken: authToken });
                return updatedMachine;
            }
            return machine;
        });
        this.setMachines(newMachines);
        this.updateAppsAuthToken(updatedMachine);
    };
    MachineHelper.prototype.updateAppsAuthToken = function (updatedMachine) {
        if (!updatedMachine)
            return;
        var newApps = this.apps.map(function (app) {
            if (app.machineToDeploy.name === updatedMachine.name) {
                return __assign({}, app, { machineToDeploy: updatedMachine });
            }
            return app;
        });
        this.setApps(newApps);
    };
    MachineHelper.prototype.setApps = function (newApps) {
        this.apps = newApps;
        configs.set("apps", newApps);
    };
    MachineHelper.prototype.addMachine = function (newMachine) {
        var tempMachines = this.machines;
        var newMachines = tempMachines.concat([newMachine]);
        // Add to local storage
        configs.set("captainMachines", newMachines);
        this.setMachines(configs.get("captainMachines"));
    };
    MachineHelper.prototype.logoutMachine = function (machineName) {
        var removedMachine = this.machines.filter(function (machine) { return machine.name === machineName; })[0];
        var newMachines = this.machines.filter(function (machine) { return machine.name !== machineName; });
        this.setMachines(newMachines);
        printMessage("You are now logged out from " + removedMachine.name + " at " + removedMachine.baseUrl + "...\n");
    };
    return MachineHelper;
}());
module.exports = new MachineHelper();
