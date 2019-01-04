#!/usr/bin/env node

const chalk = require('chalk');
import MachineHelper from '../helpers/MachineHelper';
import { IMachine } from '../models/IModels';
const { printMessage } = require('../utils/messageHandler');

function _displayMachine(machine: IMachine) {
	console.log('>> ' + chalk.greenBright(machine.name) + ' at ' + chalk.cyan(machine.baseUrl));
}

function list() {
	printMessage('\nLogged in Captain Machines:\n');

	MachineHelper.getMachines().map((machine) => {
		_displayMachine(machine);
	});

	printMessage('');
}

export = list;
