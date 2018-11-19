var express = require('express');
var bodyParser = require('body-parser');
var router = express.Router();
var TokenApi = require('../api/TokenApi');
var BaseApi = require('../api/BaseApi');
var Authenticator = require('../user/Authenticator');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var Logger = require('../utils/Logger');
var CaptainConstants = require('../utils/CaptainConstants');
var urlencodedParser = bodyParser.urlencoded({ extended: true });
router.post('/triggerbuild', urlencodedParser, function (req, res, next) {
    // find which branch is pushed
    // inject it in locals.pushedBranches
    var isGithub = req.header('X-GitHub-Event') === 'push';
    var isBitbucket = (req.header('X-Event-Key') === 'repo:push') && req.header('X-Request-UUID') && req.header('X-Hook-UUID');
    var isGitlab = req.header('X-Gitlab-Event') === 'Push Hook';
    res.locals.pushedBranches = [];
    if (isGithub) {
        var refPayloadByFormEncoded = req.body.payload;
        var bodyJson = req.body;
        if (refPayloadByFormEncoded) {
            bodyJson = JSON.parse(refPayloadByFormEncoded);
        }
        var ref = bodyJson.ref; // "refs/heads/somebranch"
        res.locals.pushedBranches.push(ref.substring(11, ref.length));
    }
    else if (isBitbucket) {
        for (var i = 0; i < req.body.push.changes.length; i++) {
            res.locals.pushedBranches.push(req.body.push.changes[i].new.name);
        }
    }
    else if (isGitlab) {
        var ref = req.body.ref; // "refs/heads/somebranch"
        res.locals.pushedBranches.push(ref.substring(11, ref.length));
    }
    next();
});
router.post('/triggerbuild', function (req, res, next) {
    res.sendStatus(200);
    var serviceManager = res.locals.user.serviceManager;
    var appName = res.locals.appName;
    var app = res.locals.app;
    var namespace = res.locals.user.namespace;
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
            var branchIsTracked = false;
            for (var i = 0; i < res.locals.pushedBranches.length; i++) {
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
