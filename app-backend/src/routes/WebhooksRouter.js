const express = require('express');
const router = express.Router();
const TokenApi = require('../api/TokenApi');
const BaseApi = require('../api/BaseApi');
const Authenticator = require('../user/Authenticator');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const Logger = require('../utils/Logger');
const CaptainConstants = require('../utils/CaptainConstants');


router.post('/triggerbuild', function (req, res, next) {

    // find which branch is pushed
    // inject it in locals.pushedBranches

    let isGithub = req.header('X-GitHub-Event') === 'push';
    let isBitbucket = (req.header('X-Event-Key') === 'repo:push') && req.header('X-Request-UUID') && req.header('X-Hook-UUID');

    res.locals.pushedBranches = [];

    if (isGithub) {
        let ref = req.body.ref; // "ref/heads/somebranch"
        res.locals.pushedBranches.push(ref.substring(11, ref.length));
    }
    else if (isBitbucket) {
        for (let i = 0; i < req.body.push.changes.length; i++) {
            res.locals.pushedBranches.push(req.body.push.changes[i].new.name);
        }
    }

    next();

});

router.post('/triggerbuild', function (req, res, next) {

    res.sendStatus(200);
    let serviceManager = res.locals.user.serviceManager;
    let appName = res.locals.appName;
    let app = res.locals.app;
    let namespace = res.locals.user.namespace;

    if (!app || !serviceManager || !namespace || !appName) {
        Logger.e('Something went wrong during trigger build. Cannot extract app information from the payload.');
        return;
    }

    Promise.resolve()
        .then(function () {

            return Authenticator.get(namespace)
                .decodeAppPushWebhookDatastore(app.appPushWebhook.repoInfo);
        })
        .then(function (repoInfo) {

            // if we didn't detect any branches, the POST might have come from another source that we don't
            // explicitly support. Therefore, we just let it go through and triggers a build anyways
            if (res.locals.pushedBranches.length > 0) {
                let branchIsTracked = false;

                for (let i = 0; i < res.locals.pushedBranches.length; i++) {
                    if (res.locals.pushedBranches[i] === repoInfo.branch) {
                        branchIsTracked = true;
                        break;
                    }
                }

                // POST call was triggered due to another branch being pushed. We don't need to trigger the build.
                if (!branchIsTracked) {
                    return;
                }

            }

            return serviceManager
                .createImage(appName, {
                    repoInfo: repoInfo
                })
                .then(function (version) {

                    return serviceManager.ensureServiceInitedAndUpdated(appName, version);

                });

        })
        .catch(function (error) {
            Logger.e(error);
        });

});

module.exports = router;
