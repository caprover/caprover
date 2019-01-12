"use strict";
const Utils_1 = require("./Utils");
const git = require('simple-git');
class GitHelper {
    static getLastHash(directory) {
        return new Promise(function (resolve, reject) {
            git(directory)
                .silent(true)
                .raw(['rev-parse', 'HEAD'], function (err, result) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            });
        });
    }
    static clone(username, pass, repo, branch, directory) {
        const USER = encodeURIComponent(username);
        const PASS = encodeURIComponent(pass);
        // Some people put https when they are entering their git information
        const REPO = Utils_1.default.removeHttpHttps(repo);
        const remote = `https://${USER}:${PASS}@${REPO}`;
        return new Promise(function (resolve, reject) {
            git()
                .silent(true)
                .raw(['clone', '--recursive', '-b', branch, remote, directory], function (err, result) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(result);
                }
            });
        });
    }
}
module.exports = GitHelper;
//# sourceMappingURL=GitHelper.js.map