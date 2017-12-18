const express = require('express');
const router = express.Router();
const TokenApi = require('../api/TokenApi');
const BaseApi = require('../api/BaseApi');
const Authenticator = require('../user/Authenticator');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const Logger = require('../utils/Logger');
const CaptainConstants = require('../utils/CaptainConstants');

router.post('/triggerbuild', function (req, res, next) {

    res.sendStatus(200);
    let serviceManager = res.locals.user.serviceManager;
    let appName = res.locals.appName;
    let app = res.locals.app;
    let namespace = res.locals.user.namespace;

    if (!app || !serviceManager || !namespace|| !appName) {
        Logger.e('Something went wrong during trigger build. Cannot extract app information from the payload.');
        return;
    }

    Promise.resolve()
        .then(function () {

            return Authenticator.get(namespace)
                .decodeAppPushWebhookDatastore(app.appPushWebhook.repoInfo);
        })
        .then(function (repoInfo) {

            return serviceManager.createImage(appName, {
                repoInfo: repoInfo
            });

        })
        .then(function (version) {

            return serviceManager.ensureServiceInitedAndUpdated(appName, version);

        })
        .catch(function (error) {
            Logger.e(error);
        });

});

module.exports = router;
