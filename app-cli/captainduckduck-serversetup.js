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
    .description('Easy setup for your Captain server.')
    .parse(process.argv);


if (program.args.length) {
    console.error(chalk.red('Unrecognized commands:'));
    program.args.forEach(function (arg) {
        console.log(chalk.red(arg));
    });
    console.error(chalk.red('This command does not require any options. '));
    process.exit(1);
}

function findDefaultCaptainName() {

    let machines = configs.get('captainMachines');
    let currentSuffix = machines.length + 1;

    function getCaptainFullName(suffix) {
        if (suffix < 10) {
            suffix = '0' + suffix;
        }
        return 'captain-' + suffix;
    }

    function isSuffixValid(suffixNumber) {
        for (let i = 0; i < machines.length; i++) {
            let m = machines[i];
            if (m.name === getCaptainFullName(suffixNumber)) {
                return false;
            }
        }
        return true;
    }

    while (!isSuffixValid(currentSuffix)) {
        currentSuffix++;
    }

    return getCaptainFullName(currentSuffix);
}

function isIpAddress(ipaddress) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
        return (true)
    }
    return (false)
}


console.log(' ');
console.log('Setup your Captain server');
console.log(' ');

const SAMPLE_IP = '123.123.123.123';

var authTokenFromLogin = null;
var ipAddressOfServer = null;
var customDomainFromUser = null;
var newPasswordFirstTry = null;
var oldPassword = 'captain42';

function setCustomDomain(baseApiUrl, customDomain) {

    return apiEnpoint('POST', baseApiUrl, '/api/v1/user/system/changerootdomain/', {
        rootDomain: customDomain
    });
}

function enableHttps(baseApiUrl, emailAddress) {

    return apiEnpoint('POST', baseApiUrl, '/api/v1/user/system/enablessl/', {
        emailAddress: emailAddress
    });

}

function changePass(baseApiUrl, newPass) {

    return apiEnpoint('POST', baseApiUrl, '/api/v1/user/changepassword/', {
        oldPassword: oldPassword,
        newPassword: newPass
    });

}

function forceHttps(baseApiUrl) {

    return apiEnpoint('POST', baseApiUrl, '/api/v1/user/system/forcessl/', {
        isEnabled: true
    });
}

// returns promise that resolves to auth token
// rejects with ErrorCode or null
function login(baseApiUrl, password) {

    return apiEnpoint('POST', baseApiUrl, '/api/v1/login', {
        password: password
    }).then(function (data) {
        return data.token;
    })

}

function apiEnpoint(method, baseApiUrl, endpoint, dataToSend) {

    let options = {
        url: baseApiUrl + endpoint,
        headers: {
            'x-namespace': 'captain',
            'x-captain-auth': authTokenFromLogin
        },
        method: method,
        form: dataToSend
    };

    return new Promise(function (res, rej) {

        var callback = function (error, response, body) {

            try {

                if (!error && response.statusCode === 200) {

                    let data = JSON.parse(body);

                    if (data.status !== 100) {
                        rej(data);
                        return;
                    }

                    res(data);

                    return;
                }

                if (error) {
                    throw new Error(error)
                }

                throw new Error(response ? JSON.stringify(response, null, 2) : 'Response NULL');

            } catch (error) {
                console.error(chalk.red('Something bad happened. Cannot connect to "' + baseApiUrl + endpoint + '"'));
                let errorMessage = error.message ? error.message : error;
                console.error(chalk.red(errorMessage));
                console.log(' ');
                process.exit(0);
            }
        }

        request(options, callback);

    });
}

const questions = [
    {
        type: 'list',
        name: 'hasInstalledCaptain',
        message: 'Have you already installed Captain on your server by running the following line:'
            + '\nmkdir /captain && docker run -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck ?',
        default: 'Yes',
        choices: ['Yes', 'No'],
        filter: function (value) {
            return new Promise(function (res, rej) {

                if (value === 'Yes') {
                    res(true);
                    return;
                }

                console.log('');
                console.log('');
                console.log(' Cannot start the setup process if Captain is not installed.');
                console.log(' Please read tutorial on CaptainDuckDuck.com'
                    + ' to learn how to install CaptainDuckDuck on a server.');
                console.log('');

                process.exit(0);
            });
        }
    },
    {
        type: 'input',
        default: SAMPLE_IP,
        name: 'captainAddress',
        message: 'Enter IP address of your captain server:',
        filter: function (value) {
            return new Promise(function (res, rej) {

                if (value === SAMPLE_IP) {
                    rej('Enter a valid IP Address');
                    return;
                }

                if (!isIpAddress(value.trim())) {
                    rej('This is an invalid IP Address: ' + value);
                    return;
                }

                ipAddressOfServer = value.trim();

                //login using captain42.

                return login('http://' + ipAddressOfServer + ':3000', oldPassword)
                    .then(function (authTokenFetched) {
                        authTokenFromLogin = authTokenFetched;
                        res(ipAddressOfServer);
                    })
                    .catch(function (error) {

                        // if error is anything but password wrong, exit here...
                        if (error.status == 1105) {
                            authTokenFromLogin = null;
                            res(ipAddressOfServer);
                            return;
                        }

                        console.log('');

                        if (error.status) {
                            console.log(chalk.red('Error: ' + error.status));
                            console.log(chalk.red('Error: ' + error.description));
                        } else {
                            console.log(chalk.red('Error: ' + error));
                        }

                        process.exit(0);


                    });
            })
        }
    },
    {
        type: 'password',
        name: 'captainOriginalPassword',
        message: 'Enter your current password:',
        when: function () {
            return !authTokenFromLogin;
        },
        filter: function (value) {
            return new Promise(function (res, rej) {

                console.log('');

                return login('http://' + ipAddressOfServer + ':3000', value)
                    .then(function (authTokenFetched) {
                        authTokenFromLogin = authTokenFetched;
                        oldPassword = value;
                        res(value);
                    })
                    .catch(function (error) {
                        console.log('');

                        if (error.status) {
                            console.log(chalk.red('Error: ' + error.status));
                            console.log(chalk.red('Error: ' + error.description));
                        } else {
                            console.log(chalk.red('Error: ' + error));
                        }

                        process.exit(0);
                    });
            })
        }
    },
    {
        type: 'input',
        name: 'captainRootDomain',
        message: 'Enter a root domain for this Captain server. For example, enter test.yourdomain.com if you' +
            ' setup your DNS to point *.test.yourdomain.com to ' + ipAddressOfServer + ': ',
        filter: function (value) {
            return new Promise(function (res, rej) {

                value = value.trim();

                customDomainFromUser = 'captain.' + value;

                return setCustomDomain('http://' + ipAddressOfServer + ':3000', value)
                    .then(function () {
                        res(customDomainFromUser);
                    })
                    .catch(function (error) {
                        console.log('');
                        if (error.status) {
                            console.log(chalk.red('Error: ' + error.status));
                            console.log(chalk.red('Error: ' + error.description));
                        } else {
                            console.log(chalk.red('Error: ' + error));
                        }
                        process.exit(0);
                    });
            })
        }
    },
    {
        type: 'input',
        name: 'emailAddress',
        message: 'Enter your "valid" email address to enable HTTPS: ',
        filter: function (value) {
            return new Promise(function (res, rej) {

                console.log('');
                value = value.trim();

                return enableHttps('http://' + customDomainFromUser, value)
                    .then(function () {
                        return forceHttps('https://' + customDomainFromUser);
                    })
                    .then(function () {
                        res(value);
                    })
                    .catch(function (error) {
                        console.log('');
                        if (error.status) {
                            console.log(chalk.red('Error: ' + error.status));
                            console.log(chalk.red('Error: ' + error.description));
                        } else {
                            console.log(chalk.red('Error: ' + error));
                        }

                        process.exit(0);
                    });
            })
        }
    },
    {
        type: 'password',
        name: 'newPasswordFirstTry',
        message: 'Enter a new password:',
        filter: function (value) {
            return new Promise(function (res, rej) {

                newPasswordFirstTry = value;
                res(value);

            })
        }
    },
    {
        type: 'password',
        name: 'newPassword',
        message: 'Enter a new password:',
        filter: function (value) {
            return new Promise(function (res, rej) {

                if (newPasswordFirstTry !== value) {
                    rej('Passwords do not match');
                    //process.exit(0);
                    return;
                }

                return changePass('https://' + customDomainFromUser, value)
                    .then(function () {
                        return login('https://' + customDomainFromUser, value)
                    })
                    .then(function (token) {
                        authTokenFromLogin = token;
                        res(value);
                    })
                    .catch(function (error) {
                        console.log('');
                        if (error.status) {
                            console.log(chalk.red('Error: ' + error.status));
                            console.log(chalk.red('Error: ' + error.description));
                        } else {
                            console.log(chalk.red('Error: ' + error));
                        }

                        process.exit(0);
                    });
            })
        }
    },
    {
        type: 'input',
        name: 'captainName',
        message: 'Enter a name for this Captain machine:',
        default: findDefaultCaptainName(),
        validate: function (value) {

            let machines = configs.get('captainMachines');
            for (let i = 0; i < machines.length; i++) {
                if (machines[i].name === value) {
                    return value + ' already exist. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.'
                }
            }

            if (value.match(/^[-\d\w]+$/i)) {
                return true;
            }

            return 'Please enter a Captain Name.';
        }
    }
];

inquirer.prompt(questions).then(function (answers) {


    console.log(' ');
    console.log(' ');
    let machines = configs.get('captainMachines');
    machines.push({
        authToken: authTokenFromLogin,
        baseUrl: 'https://' + customDomainFromUser,
        name: answers.captainName
    });
    configs.set('captainMachines', machines);

});



