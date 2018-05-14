#!/usr/bin/env node

const exec = require('child_process').exec;
const request = require('request');

const version = require('./src/utils/CaptainConstants').version;
const publishedNameOnDockerHub = require('./src/utils/CaptainConstants').publishedNameOnDockerHub;

console.log(version);
console.log(' ');


exec('git status', function (err, stdout, stderr) {

    if (err) {
        console.log(err);
        return;
    }

    var l1 = 'On branch master';
    var l2 = 'Your branch is up to date with \'origin/master\'';
    var l3 = 'nothing to commit, working tree clean';

    if (stdout.indexOf(l1) < 0 || stdout.indexOf(l2) < 0 || stdout.indexOf(l3) < 0) {
        console.log('Make sure you are on master branch, in sync with remote, and your working directory is clean');
        return;
    }
    fetchTagsFromHub();
});

function fetchTagsFromHub() {

    var URL = 'https://hub.docker.com/v2/repositories/' + publishedNameOnDockerHub + '/tags';

    request(URL, function (error, response, body) {

        if (body) {
            body = JSON.parse(body);
        }

        if (error || !body || !body.results || !body.results.length) {
            console.log('Error while fetching tags from Docker Hub!');
            console.log(error);
            return;
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

            if ((getTagValue(version) - highestTagValue) === 1) // hotfix version fix
            {
                isVersionValid = true;
            }

            if ((getTagValue(version) - highestTagValue) <= 1000 && getTagValue(version) % 1000 === 0) { //minor version upgrade
                isVersionValid = true;
            }
        }

        if (!isVersionValid || !highestTagValue) {
            console.log('The version you are pushing is not valid!');
            return;
        }

        console.log('Pushing ' + version);

        buildAndPush();


    });
}


function buildAndPush() {

    var t1 = publishedNameOnDockerHub + ':' + 'latest';
    var t2 = publishedNameOnDockerHub + ':' + version;
    let command = 'docker build -t ' + t1 + ' -t ' + t2 + ' -f dockerfile-captain.release . && docker push ' + t1 + ' && docker push ' + t2;
    exec(command, function (err, stdout, stderr) {

        if (err) {
            console.log('ERROR');
            console.log(err);
        }
        if (stdout) {
            console.log('stdout');
            console.log(stdout);
        }
        if (stderr) {
            console.log('stderr');
            console.log(stderr);
        }

    });

}