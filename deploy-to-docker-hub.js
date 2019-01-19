#!/usr/bin/env node

const execOriginal = require('child_process').exec;
const requestOriginal = require('request');

function exec(command) {
    return new Promise(function (resolve, reject) {
        execOriginal(command, function (err, stdout, stderr) {

            if (stderr) {
                console.log('stderr');
                console.log(stderr);
            }

            if (err) {
                reject(err)
                return
            }

            resolve(stdout)
        })
    })
}


function request(url) {
    return new Promise(function (resolve, reject) {
        requestOriginal(url, function (error, response, body) {
            if (body) {
                body = JSON.parse(body);
            }

            if (error || !body) {
                console.log('Error while fetching tags from Docker Hub!');
                reject(error);
                return;
            }


            resolve(body)
        })
    })
}



const publishedNameOnDockerHub = 'caprover/caprover';
let version = ''

exec('npm run build')
    .then(function (data) {
        data = (data + '').trim()
        console.log('----------')
        console.log(data)
        console.log('----------')
        if (!data.startsWith('> caprover@0.0.0') || !data.endsWith('rm -rf ./built && npx tsc')) {
            console.log('Unexpected output:')
            throw new Error(data)
        }

        return exec(`rm -rf ./build`)

    })
    .then(function () {
        version = require('./built/utils/CaptainConstants').configs.version;

        return exec('git status')
    })
    .then(function (data) {
        var l1 = 'On branch master';
        var l2 = 'Your branch is up to date with \'origin/master\'';
        var l3 = 'nothing to commit, working tree clean';

        if (data.indexOf(l1) < 0 || data.indexOf(l2) < 0 || data.indexOf(l3) < 0) {
            console.log('Make sure you are on master branch, in sync with remote, and your working directory is clean');
            throw new Error(data)
        }

        var URL = 'https://hub.docker.com/v2/repositories/' + publishedNameOnDockerHub + '/tags';

        return request(URL)

    })
    .then(function (body) {

        if (!body.results || !body.results.length) {
            console.log('Error while fetching tags from Docker Hub!');
            throw error;
        }

        var highestTag = '';
        var highestTagValue = 0;

        function getTagValue(tag) {
            var sp = tag.split('.');
            return (Number(sp[0]) * 1000 * 1000 + Number(sp[1]) * 1000 + Number(sp[2]));
        }

        for (var i = 0; i < body.results.length; i++) {

            var t = body.results[i].name;
            var value = getTagValue(t);

            if (value > highestTagValue) {
                highestTagValue = value;
                highestTag = t;
            }
        }

        var isVersionValid = false;

        if (getTagValue(version) > highestTagValue) {
            isVersionValid = true;
        }

        if (!isVersionValid || !highestTagValue || !version) {
            console.log(`isVersionValid: ${isVersionValid}   highestTagValue: ${highestTagValue}`)
            throw new Error('The version you are pushing is not valid! ' + version);
        }

        console.log('Pushing ' + version);

        var t1 = publishedNameOnDockerHub + ':' + 'latest';
        var t2 = publishedNameOnDockerHub + ':' + version;


        return exec(`sudo docker build -t ${t1} -t ${t2} -f dockerfile-captain.release . && docker push ${t1} && docker push ${t2}`)
    })
    .then(function (stdout) {
        if (stdout) {
            console.log('stdout');
            console.log(stdout);
        }

    })
    .catch(function (err) {
        console.error(err)
        process.exit(1)
    })