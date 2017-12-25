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


console.log(' ');
console.log(' ');

program
    .description('Deploy current directory to a Captain machine.')
    .parse(process.argv);


if (program.args.length) {
    console.error(chalk.red('Unrecognized commands:'));
    program.args.forEach(function (arg) {
        console.log(chalk.red(arg));
    });
    console.error(chalk.red('Deploy does not require any options. '));
    process.exit(1);
}

if (!fs.pathExistsSync('./.git')) {
    console.log(chalk.bold.yellow('**** WARNING: You are not in a git root directory. This command will only deploys the current directory ****'));
    console.log(' ');
    console.log(' ');

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

function getAppForDirectory() {
    let apps = configs.get('apps');
    for (let i = 0; i < apps.length; i++) {
        let app = apps[i];
        if (app.cwd === process.cwd()) {
            return app.appName;
        }
    }
    return undefined;
}

function saveAppForDirectory(appName) {
    let apps = configs.get('apps');
    for (let i = 0; i < apps.length; i++) {
        let app = apps[i];
        if (app.cwd === process.cwd()) {
            app.appName = appName;
            return;
        }
    }

    apps.push({
        cwd: process.cwd(),
        appName: appName
    });

    configs.set('apps', apps);
}


console.log('Preparing deployment to Captain...');
console.log(' ');


const questions = [
    {
        type: 'list',
        name: 'captainNameToDeploy',
        message: 'Select the Captain Machine you want to deploy to:',
        choices: listOfMachines
    },
    {
        type: 'input',
        default: 'master',
        name: 'branchToPush',
        message: 'Enter the "git" branch you would like to deploy:',
        when: function (answers) {
            return !!answers.captainNameToDeploy;
        }
    },
    {
        type: 'input',
        default: getAppForDirectory(),
        name: 'appName',
        message: 'Enter the Captain app name this directory will be deployed to:',
        when: function (answers) {
            return !!answers.captainNameToDeploy;
        }
    },
    {
        type: 'confirm',
        name: 'confirmedToDeploy',
        message: 'Note that uncommited files and files in gitignore (if any) will not be pushed to server. Please confirm so that deployment process can start.',
        default: true,
        when: function (answers) {
            return !!answers.captainNameToDeploy;
        }
    }
];

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

function deployTo(machineToDeploy, branchToPush, appName) {
    if (!commandExistsSync('git')) {
        console.log(chalk.red('"git" command not found...'));
        console.log(chalk.red('Captain needs "git" to create zip file of your source files...'));
        console.log(' ');
        process.exit(1);
    }

    let zipFileNameToDeploy = 'temporary-captain-to-deploy.zip';
    let zipFileFullPath = path.join(process.cwd(), zipFileNameToDeploy);

    console.log('Saving zip file to:');
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

            sendFileToCaptain(machineToDeploy, zipFileFullPath, appName, gitHash);

        });
    });

}

function sendFileToCaptain(machineToDeploy, zipFileFullPath, appName, gitHash) {

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
        url: machineToDeploy.baseUrl + '/api/v1/user/appData/' + appName,
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

                if (data.status !== 100) {
                    throw new Error(JSON.stringify(data, null, 2));
                }

                saveAppForDirectory(appName);

                console.log(chalk.green('Deployed successful: ') + appName);
                console.log(' ');

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


