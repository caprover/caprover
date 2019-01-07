#!/usr/bin/env node

import chalk from 'chalk';
import StdOutUtil from '../utils/StdOutUtil';
import StorageHelper from '../utils/StorageHelper';
import { IMachine } from '../models/storage/StoredObjects';

function _displayMachine(machine: IMachine) {
	console.log('>> ' + chalk.greenBright(machine.name) + ' at ' + chalk.cyan(machine.baseUrl));
}

function list() {
	StdOutUtil.printMessage('\nLogged in Captain Machines:\n');

	StorageHelper.get().getMachines().map((machine) => {
		_displayMachine(machine);
	});

	StdOutUtil.printMessage('');
}

export default list;
