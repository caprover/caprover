#!/usr/bin/env node
var chalk = require("chalk");
var MachineHelper = require("../helpers/MachineHelper");
var printMessage = require("../utils/messageHandler").printMessage;
function _displayMachine(machine) {
    console.log(">> " +
        chalk.greenBright(machine.name) +
        " at " +
        chalk.cyan(machine.baseUrl));
}
function list() {
    printMessage("\nLogged in Captain Machines:\n");
    MachineHelper.machines.map(function (machine) {
        _displayMachine(machine);
    });
    printMessage("");
}
module.exports = list;
