"use strict";
const git = require('simple-git');
module.exports = {
    getLastHash: function (directory) {
        return new Promise(function (resolve, reject) {
            git(directory).silent(true)
                .raw([
                'rev-parse',
                'HEAD'
            ], function (err, result) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            });
        });
    },
    clone: function (username, pass, repo, branch, directory) {
        const USER = encodeURIComponent(username);
        const PASS = encodeURIComponent(pass);
        const remote = `https://${USER}:${PASS}@${repo}`;
        return new Promise(function (resolve, reject) {
            git().silent(true)
                .raw([
                'clone',
                '--recursive',
                '-b',
                branch,
                remote,
                directory
            ], function (err, result) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            });
        });
    }
};
//# sourceMappingURL=GitHelper.js.map