#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = require("chalk");
const StdOutUtil_1 = require("../utils/StdOutUtil");
const StorageHelper_1 = require("../utils/StorageHelper");
function _displayMachine(machine) {
    console.log('>> ' + chalk_1.default.greenBright(machine.name) + ' at ' + chalk_1.default.cyan(machine.baseUrl));
}
function list() {
    StdOutUtil_1.default.printMessage('\nLogged in Captain Machines:\n');
    StorageHelper_1.default.get().getMachines().map((machine) => {
        _displayMachine(machine);
    });
    StdOutUtil_1.default.printMessage('');
}
exports.default = list;
//# sourceMappingURL=list.js.map