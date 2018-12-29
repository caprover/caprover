#!/usr/bin/env node

const program = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const configstore = require('configstore');
const request = require('request');

const packagejson = require('./package.json');


const configs = new configstore(packagejson.name, {
    captainMachines: []
});


program
    .description('List all Captain machines currently logged in.')
    .parse(process.argv);

if (program.args.length) {
    console.error(chalk.red('Unrecognized commands:'));
    program.args.forEach(function (arg) {
        console.log(chalk.red(arg));
    });
    console.error(chalk.red('List does not require any options. '));
    process.exit(1);
}
console.log();
console.log('Logged in Captain Machines:');
console.log();
let machines = configs.get('captainMachines');
for (let i = 0; i < machines.length; i++) {

    console.log('>> ' + chalk.greenBright(machines[i].name) + ' at ' + chalk.cyan(machines[i].baseUrl));

}
console.log();


