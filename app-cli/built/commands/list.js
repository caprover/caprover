#!/usr/bin/env node
"use strict";
const chalk = require('chalk');
const MachineHelper_1 = require("../helpers/MachineHelper");
const { printMessage } = require('../utils/messageHandler');
function _displayMachine(machine) {
    console.log('>> ' + chalk.greenBright(machine.name) + ' at ' + chalk.cyan(machine.baseUrl));
}
function list() {
    printMessage('\nLogged in Captain Machines:\n');
    MachineHelper_1.default.getMachines().map((machine) => {
        _displayMachine(machine);
    });
    printMessage('');
}
module.exports = list;
//# sourceMappingURL=list.js.map