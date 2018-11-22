const git = require("simple-git");

export = {
    getLastHash: function(directory: string) {

        return new Promise<string>(function(resolve, reject) {

            git(directory).silent(true)
                .raw([
                    "rev-parse",
                    "HEAD",

                ], function(err: any, result: string) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
        });
    },

    clone: function(username: string, pass: string, repo: string, branch: string, directory: string) {

        const USER = encodeURIComponent(username);
        const PASS = encodeURIComponent(pass);

        const remote = `https://${USER}:${PASS}@${repo}`;

        return new Promise<string>(function(resolve, reject) {

            git().silent(true)
                .raw([
                    "clone",
                    "--recursive",
                    "-b",
                    branch,
                    remote,
                    directory,
                ], function(err: any, result: string) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(result);
                    }
                });
        });

    },
};