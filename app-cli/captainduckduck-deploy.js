const program = require('commander');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const configstore = require('configstore');
const request = require('request');
const commandExistsSync = require('command-exists').sync;
const ProgressBar = require('progress');
const ora = require('ora');
const { exec } = require('child_process');

const packagejson = require('./package.json');

const configs = new configstore(packagejson.name, {
    captainMachines: [],
    apps: []
});

const BRANCH_TO_PUSH = 'branchToPush';
const APP_NAME = 'appName';
const MACHINE_TO_DEPLOY = 'machineToDeploy';
const EMPTY_STRING = '';

console.log(' ');
console.log(' ');

program
    .description('Deploy current directory to a Captain machine.')
    .option('-d, --default', 'Run with default options')
    .option('-s, --stateless', 'Run deploy stateless')
    .option('-h, --host <value>', 'Only for stateless mode: Host of the captain machine')
    .option('-a, --appName <value>', 'Only for stateless mode: Name of the app')
    .option('-p, --pass <value>', 'Only for stateless mode: Password for Captain')
    .option('-b, --branch [value]', 'Only for stateless mode: Branch name (default master)')
    .parse(process.argv);


if (program.args.length) {
    console.error(chalk.red('Unrecognized commands:'));
    program.args.forEach(function (arg) {
        console.log(chalk.red(arg));
    });
    console.error(chalk.red('Deploy does not require any options. '));
    process.exit(1);
}

function printErrorAndExit(error) {
    console.log(chalk.bold.red(error));
    console.log(' ');
    console.log(' ');
    process.exit(0);
}

if (!fs.pathExistsSync('./.git')) {
    printErrorAndExit('**** ERROR: You are not in a git root directory. This command will only deploys the current directory ****');
}

if (!fs.pathExistsSync('./captain-definition')) {
    printErrorAndExit('**** ERROR: captain-definition file cannot be found. Please see docs! ****');
}

const contents = fs.readFileSync('./captain-definition', 'utf8');
let contentsJson = null;

try {
    contentsJson = JSON.parse(contents);
} catch (e) {
    console.log(e);
    console.log('');
    printErrorAndExit('**** ERROR: captain-definition file is not a valid JSON! ****');
}

if (!contentsJson.schemaVersion) {
    printErrorAndExit('**** ERROR: captain-definition needs schemaVersion. Please see docs! ****');
}

if (!contentsJson.templateId && !contentsJson.dockerfileLines) {
    printErrorAndExit('**** ERROR: captain-definition needs templateId or dockerfileLines. Please see docs! ****');
}

if (contentsJson.templateId && contentsJson.dockerfileLines) {
    printErrorAndExit('**** ERROR: captain-definition needs templateId or dockerfileLines, NOT BOTH! Please see docs! ****');
}

let listOfMachines = [{
    name: '-- CANCEL --',
    value: EMPTY_STRING,
    short: EMPTY_STRING
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

// Gets default value for propType that is stored in a directory.
// Replaces getAppForDirectory
function getPropForDirectory(propType) {
    let apps = configs.get('apps');
    for (let i = 0; i < apps.length; i++) {
        let app = apps[i];
        if (app.cwd === process.cwd()) {
            return app[propType];
        }
    }
    return undefined;
}

// Sets default value for propType that is stored in a directory to propValue.
// Replaces saveAppForDirectory
function savePropForDirectory(propType, propValue) {
    let apps = configs.get('apps');
    for (let i = 0; i < apps.length; i++) {
        let app = apps[i];
        if (app.cwd === process.cwd()) {
            app[propType] = propValue;
            configs.set('apps', apps);
            return;
        }
    }

    apps.push({
        cwd: process.cwd(),
        [propType]: propValue
    });

    configs.set('apps', apps);
}


function getDefaultMachine() {
    let machine = getPropForDirectory(MACHINE_TO_DEPLOY);
    if (machine) {
        return machine.name;
    }
    if(listOfMachines.length == 2){
        return 1;
    }
    return EMPTY_STRING;
}

console.log('Preparing deployment to Captain...');
console.log(' ');


const questions = [
    {
        type: 'list',
        name: 'captainNameToDeploy',
        default: getDefaultMachine(),
        message: 'Select the Captain Machine you want to deploy to:',
        choices: listOfMachines
    },
    {
        type: 'input',
        default: getPropForDirectory(BRANCH_TO_PUSH) || 'master',
        name: BRANCH_TO_PUSH,
        message: 'Enter the "git" branch you would like to deploy:',
        when: function (answers) {
            return !!answers.captainNameToDeploy;
        }
    },
    {
        type: 'input',
        default: getPropForDirectory(APP_NAME),
        name: APP_NAME,
        message: 'Enter the Captain app name this directory will be deployed to:',
        when: function (answers) {
            return !!answers.captainNameToDeploy;
        }
    },
    {
        type: 'confirm',
        name: 'confirmedToDeploy',
        message: 'Note that uncommitted files and files in gitignore (if any) will not be pushed to server. Please confirm so that deployment process can start.',
        default: true,
        when: function (answers) {
            return !!answers.captainNameToDeploy;
        }
    }
];

let defaultInvalid = false;

if (program.default) {

    if (!getDefaultMachine() || !getPropForDirectory(BRANCH_TO_PUSH) || !getPropForDirectory(APP_NAME)) {
        console.log('Default deploy failed. Please select deploy options.');
        defaultInvalid = true;
    }
    else {
        console.log('Deploying to ' + getPropForDirectory(MACHINE_TO_DEPLOY).name);
        deployTo(getPropForDirectory(MACHINE_TO_DEPLOY), getPropForDirectory(BRANCH_TO_PUSH), getPropForDirectory(APP_NAME));
    }

}

const isStateless = program.stateless && program.host && program.appName && program.pass;

if (isStateless) {
    // login first
    console.log('Trying to login to', program.host)
    requestLoginAuth(program.host, program.pass, function (authToken) {
        // deploy
        console.log('Starting stateless deploy to', program.host, program.branch, program.appName);
        deployTo({
            baseUrl: program.host,
            authToken,
        }, program.branch || 'master', program.appName);
    });
}
else if (!program.default || defaultInvalid) {

    inquirer.prompt(questions).then(function (answers) {

        console.log(' ');
        console.log(' ');

        if (!answers.confirmedToDeploy) {
            console.log('Operation cancelled by the user...');
            console.log(' ');
        }
        else {
            let machines = configs.get('captainMachines');
            let machineToDeploy = null;
            for (let i = 0; i < machines.length; i++) {
                if (machines[i].name === answers.captainNameToDeploy) {
                    console.log('Deploying to ' + answers.captainNameToDeploy);
                    machineToDeploy = machines[i];
                    break;
                }
            }

            console.log(' ');
            deployTo(machineToDeploy, answers.branchToPush, answers.appName);
        }

    });

}



function deployTo(machineToDeploy, branchToPush, appName) {
    if (!commandExistsSync('git')) {
        console.log(chalk.red('"git" command not found...'));
        console.log(chalk.red('Captain needs "git" to create tar file of your source files...'));
        console.log(' ');
        process.exit(1);
    }

    let zipFileNameToDeploy = 'temporary-captain-to-deploy.tar';
    let zipFileFullPath = path.join(process.cwd(), zipFileNameToDeploy);

    console.log('Saving tar file to:');
    console.log(zipFileFullPath);
    console.log(' ');

    exec('git archive --format tar --output "' + zipFileFullPath + '" ' + branchToPush, function (err, stdout, stderr) {
        if (err) {
            console.log(chalk.red('TAR file failed'));
            console.log(chalk.red(err + ' '));
            console.log(' ');
            fs.removeSync(zipFileFullPath);
            return;
        }

        exec('git rev-parse ' + branchToPush, function (err, stdout, stderr) {

            const gitHash = (stdout || '').trim();

            if (err || !(/^[a-f0-9]{40}$/.test(gitHash))) {
                console.log(chalk.red('Cannot find hash of last commit on this branch: ' + branchToPush));
                console.log(chalk.red(gitHash + ' '));
                console.log(chalk.red(err + ' '));
                console.log(' ');
                return;
            }

            console.log('Pushing last commit on ' + branchToPush + ': ' + gitHash);


            sendFileToCaptain(machineToDeploy, zipFileFullPath, appName, gitHash, branchToPush);

        });
    });

}

function sendFileToCaptain(machineToDeploy, zipFileFullPath, appName, gitHash, branchToPush) {

    console.log('Uploading file to ' + machineToDeploy.baseUrl);

    const fileSize = fs.statSync(zipFileFullPath).size;
    const fileStream = fs.createReadStream(zipFileFullPath);

    const barOpts = {
        width: 20,
        total: fileSize,
        clear: true
    };
    const bar = new ProgressBar(' uploading [:bar] :percent  (ETA :etas)', barOpts);
    fileStream.on('data', function (chunk) {
        bar.tick(chunk.length);
    });

    let spinner;

    fileStream.on('end', function () {
        console.log(' ');
        console.log('This might take several minutes. PLEASE BE PATIENT...');
        spinner = ora('Building your source code...').start();
        spinner.color = 'yellow';
    });


    let options = {
        url: machineToDeploy.baseUrl + '/api/v1/user/appData/' + appName + '/?detached=1',
        headers: {
            'x-namespace': 'captain',
            'x-captain-auth': machineToDeploy.authToken
        },
        method: 'POST',
        formData: {
            sourceFile: fileStream,
            gitHash: gitHash
        }
    };

    function callback(error, response, body) {

        if (spinner) {
            spinner.stop();
        }

        if (fs.pathExistsSync(zipFileFullPath)) {
            fs.removeSync(zipFileFullPath);
        }

        try {

            if (!error && response.statusCode === 200) {

                let data = JSON.parse(body);

                if (data.status === 1106) {
                    // expired token
                    requestLogin(machineToDeploy.name, machineToDeploy.baseUrl, function callback(machineToDeployNew) {

                        deployTo(machineToDeployNew, branchToPush, appName);

                    });

                    return;
                }

                if (data.status !== 100 && data.status !== 101) {
                    throw new Error(JSON.stringify(data, null, 2));
                }

                savePropForDirectory(APP_NAME, appName);
                savePropForDirectory(BRANCH_TO_PUSH, branchToPush);
                savePropForDirectory(MACHINE_TO_DEPLOY, machineToDeploy);

                if (data.status === 100) {
                    console.log(chalk.green('Deployed successful: ') + appName);
                    console.log(' ');
                } else if (data.status === 101) {
                    console.log(chalk.green('Building started: ') + appName);
                    console.log(' ');
                    startFetchingBuildLogs(machineToDeploy, appName);
                }

                return;
            }

            if (error) {
                throw new Error(error)
            }

            throw new Error(response ? JSON.stringify(response, null, 2) : 'Response NULL');

        } catch (error) {

            console.error(chalk.red('\nSomething bad happened. Cannot deploy "' + appName + '"\n'));

            if (error.message) {
                try {
                    var errorObj = JSON.parse(error.message);
                    if (errorObj.status) {
                        console.error(chalk.red('\nError code: ' + errorObj.status));
                        console.error(chalk.red('\nError message:\n\n ' + errorObj.description));
                    } else {
                        throw new Error("NOT API ERROR");
                    }
                } catch (ignoreError) {
                    console.error(chalk.red(error.message));
                }
            } else {
                console.error(chalk.red(error));
            }
            console.log(' ');
        }
    }

    request(options, callback);

}

var lastLineNumberPrinted = -10000; // we want to show all lines to begin with!

function startFetchingBuildLogs(machineToDeploy, appName) {

    let options = {
        url: machineToDeploy.baseUrl + '/api/v1/user/appData/' + appName,
        headers: {
            'x-namespace': 'captain',
            'x-captain-auth': machineToDeploy.authToken
        },
        method: 'GET'
    };

    function onLogRetrieved(data) {

        if (data) {
            var lines = data.logs.lines;
            var firstLineNumberOfLogs = data.logs.firstLineNumber;
            var firstLinesToPrint = 0;
            if (firstLineNumberOfLogs > lastLineNumberPrinted) {

                if (firstLineNumberOfLogs < 0) {
                    // This is the very first fetch, probably firstLineNumberOfLogs is around -50
                    firstLinesToPrint = -firstLineNumberOfLogs;
                } else {
                    console.log('[[ TRUNCATED ]]');
                }

            } else {
                firstLinesToPrint = lastLineNumberPrinted - firstLineNumberOfLogs;
            }

            lastLineNumberPrinted = firstLineNumberOfLogs + lines.length;

            for (var i = firstLinesToPrint; i < lines.length; i++) {
                console.log((lines[i] || '').trim());
            }
        }

        if (data && !data.isAppBuilding) {
            console.log(' ');
            if (!data.isBuildFailed) {
                console.log(chalk.green('Deployed successful: ') + appName);
                console.log(chalk.magenta('App is available at ') + (machineToDeploy.baseUrl.replace('//captain.', '//' + appName + '.')));
            } else {
                console.error(chalk.red('\nSomething bad happened. Cannot deploy "' + appName + '"\n'));
            }
            console.log(' ');
            return;
        }

        setTimeout(function () {
            startFetchingBuildLogs(machineToDeploy, appName);
        }, 2000);
    }


    function callback(error, response, body) {

        try {

            if (!error && response.statusCode === 200) {

                let data = JSON.parse(body);

                if (data.status !== 100) {
                    throw new Error(JSON.stringify(data, null, 2));
                }

                onLogRetrieved(data.data);

                return;
            }

            if (error) {
                throw new Error(error)
            }

            throw new Error(response ? JSON.stringify(response, null, 2) : 'Response NULL');

        } catch (error) {

            console.error(chalk.red('\nSomething while retrieving app build logs.. "' + error + '"\n'));

            onLogRetrieved(null);
        }
    }

    request(options, callback);
}

function requestLoginAuth(serverAddress, password, authCallback) {
    let options = {
        url: serverAddress + '/api/v1/login',
        headers: {
            'x-namespace': 'captain'
        },
        method: 'POST',
        form: {
            password: password
        }
    };

    function callback(error, response, body) {

        try {

            if (!error && response.statusCode === 200) {

                let data = JSON.parse(body);

                if (data.status !== 100) {
                    throw new Error(JSON.stringify(data, null, 2));
                }

                authCallback(data.token);

                return;
            }

            if (error) {
                throw new Error(error)
            }

            throw new Error(response ? JSON.stringify(response, null, 2) : 'Response NULL');

        } catch (error) {

            if (error.message) {
                try {
                    var errorObj = JSON.parse(error.message);
                    if (errorObj.status) {
                        console.error(chalk.red('\nError code: ' + errorObj.status));
                        console.error(chalk.red('\nError message:\n\n ' + errorObj.description));
                    } else {
                        throw new Error("NOT API ERROR");
                    }
                } catch (ignoreError) {
                    console.error(chalk.red(error.message));
                }
            } else {
                console.error(chalk.red(error));
            }
            console.log(' ');

        }

        process.exit(0);
    }

    request(options, callback);
}

function requestLogin(serverName, serverAddress, loginCallback) {

    console.log('Your auth token is not valid anymore. Try to login again.');

    const questions = [
        {
            type: 'password',
            name: 'captainPassword',
            message: 'Please enter your password for ' + serverAddress,
            validate: function (value) {

                if (value && value.trim()) {
                    return true;
                }

                return ('Please enter your password for ' + serverAddress);
            }
        }
    ];

    function updateAuthTokenInConfigStoreAndReturn(authToken) {

        let machines = configs.get('captainMachines');
        for (let i = 0; i < machines.length; i++) {
            if (machines[i].name === serverName) {
                var baseUrl = machines[i].authToken = authToken;
                configs.set('captainMachines', machines);
                console.log('You are now logged back in to ' + serverAddress);
                return machines[i];
            }
        }
    }


    inquirer.prompt(questions).then(function (passwordAnswers) {

        var password = passwordAnswers.captainPassword;

        let options = {
            url: serverAddress + '/api/v1/login',
            headers: {
                'x-namespace': 'captain'
            },
            method: 'POST',
            form: {
                password: password
            }
        };

        function callback(error, response, body) {

            try {

                if (!error && response.statusCode === 200) {

                    let data = JSON.parse(body);

                    if (data.status !== 100) {
                        throw new Error(JSON.stringify(data, null, 2));
                    }

                    var newMachineToDeploy = updateAuthTokenInConfigStoreAndReturn(data.token);

                    loginCallback(newMachineToDeploy);

                    return;
                }

                if (error) {
                    throw new Error(error)
                }

                throw new Error(response ? JSON.stringify(response, null, 2) : 'Response NULL');

            } catch (error) {

                if (error.message) {
                    try {
                        var errorObj = JSON.parse(error.message);
                        if (errorObj.status) {
                            console.error(chalk.red('\nError code: ' + errorObj.status));
                            console.error(chalk.red('\nError message:\n\n ' + errorObj.description));
                        } else {
                            throw new Error("NOT API ERROR");
                        }
                    } catch (ignoreError) {
                        console.error(chalk.red(error.message));
                    }
                } else {
                    console.error(chalk.red(error));
                }
                console.log(' ');

            }

            process.exit(0);
        }

        request(options, callback);

    });

}
