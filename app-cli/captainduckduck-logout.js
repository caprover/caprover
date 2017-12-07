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
    .description('Logout from a specific Captain machine.')
    .parse(process.argv);


if (program.args.length) {
    console.error(chalk.red('Unrecognized commands:'));
    program.args.forEach(function (arg) {
        console.log(chalk.red(arg));
    });
    console.error(chalk.red('Logout does not require any options. '));
    process.exit(1);
}

let listOfMachines = [{
    name: '-- CANCEL --',
    value: '',
    short: ''
}];
let machines = configs.get('captainMachines');
for (let i = 0; i < machines.length; i++) {
    let m = machines[i];
    listOfMachines.push({
        name: m.name + ' at ' + m.baseUrl,
        value: m.name,
        short: m.name + ' at ' + m.baseUrl
    })
}

console.log('Logout from a Captain Machine and clear auth info');

const questions = [
    {
        type: 'list',
        name: 'captainNameToLogout',
        message: 'Select the Captain Machine you want to logout from:',
        choices: listOfMachines
    },
    {
        type: 'confirm',
        name: 'confirmedToLogout',
        message: 'Are you sure you want to logout from this Captain machine?',
        default: false,
        when: function (answers) {
            return !!answers.captainNameToLogout;
        }
    }
];

inquirer.prompt(questions).then(function (answers) {

    console.log(' ');
    console.log(' ');

    if (!answers.captainNameToLogout) {
        console.log('Operation cancelled by the user...');
    }
    else {
        let machines = configs.get('captainMachines');
        for (let i = 0; i < machines.length; i++) {
            if (machines[i].name === answers.captainNameToLogout) {
                var baseUrl = machines[i].baseUrl;
                machines.splice(i);
                configs.set('captainMachines', machines);
                console.log('You are now logged out from ' + answers.captainNameToLogout + ' at ' + baseUrl + '...');
                break;
            }
        }
    }
    console.log(' ');

});



