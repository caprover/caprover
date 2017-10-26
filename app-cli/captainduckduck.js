#!/usr/bin/env node

const packagejson = require('./package.json');
const updateNotifier = require('update-notifier');
 
updateNotifier({pkg:packagejson}).notify();


const program = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

program
    .version(packagejson.version + '')
    .description(packagejson.description)
    .command('login', 'Login to a CaptainDuckDuck machine. You can be logged in to multiple machines simultaneously.')
    .command('logout', 'Logout from a specific Captain machine.')
    .command('list', 'List all Captain machines currently logged in.')
    .command('deploy', 'Deploy your app (current directory) to a specific Captain machine. You\'ll be prompted to choose your Captain machine.')
    .parse(process.argv);
