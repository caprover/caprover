const express = require('express');
const router = express.Router();
const BaseApi = require('../api/BaseApi');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const Injector = require('../injection/Injector');
const SystemRouter = require('./SystemRouter');
const WebhooksRouter = require('./WebhooksRouter');
const AppDefinitionRouter = require('./AppDefinitionRouter');
const AppDataRouter = require('./AppDataRouter');
const Authenticator = require('../user/Authenticator');
const Logger = require('../utils/Logger');
const onFinished = require('on-finished');

const threadLockNamespace = {};

router.use('/webhooks/', Injector.injectUserForWebhook());

router.use(Injector.injectUser());

function isNotGetRequest(req) {
    return req.method !== 'GET';
}

router.use(function (req, res, next) {

    if (!res.locals.user) {
        let response = new BaseApi(ApiStatusCodes.STATUS_ERROR_NOT_AUTHORIZED,
            'The request is not authorized.');
        res.send(response);
        return;
    }

    if (!res.locals.user.initialized) {
        let response = new BaseApi(ApiStatusCodes.STATUS_ERROR_USER_NOT_INITIALIZED,
            'User data is being loaded... Please wait...');
        res.send(response);
        return;
    }

    const namespace = res.locals.user.namespace;

    if (!namespace) {
        let response = new BaseApi(ApiStatusCodes.STATUS_ERROR_NOT_AUTHORIZED,
            'Cannot find the namespace attached to this user');
        res.send(response);
        return;
    }

    const serviceManager = res.locals.user.serviceManager;

    // All requests except GET might be making changes to some stuff that are not designed for an asynchronous process
    // I'm being extra cautious. But removal of this lock mechanism requires testing and consideration of edge cases.
    if (isNotGetRequest(req)) {
        if (threadLockNamespace[namespace]) {
            let response = new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Another operation still in progress... please wait...');
            res.send(response);
            return;
        }

        let activeBuildAppName = serviceManager.isAnyBuildRunning();
        if (activeBuildAppName) {
            let response = new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC,
                `An active build (${activeBuildAppName}) is in progress... please wait...`);
            res.send(response);
            return;
        }

        // we don't want the same space to go under two simultaneous changes
        threadLockNamespace[namespace] = true;
        onFinished(res, function () {
            threadLockNamespace[namespace] = false;
        });
    }

    next();

});

router.post('/changepassword/', function (req, res, next) {

    Authenticator.get(res.locals.namespace)
        .changepass(req.body.oldPassword, req.body.newPassword)
        .then(function () {
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Password changed.'));
        })
        .catch(function (error) {
            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            } else {
                Logger.e(error);
                res.sendStatus(500);
            }
        })

});

// semi-secured end points:
router.use('/webhooks/', WebhooksRouter);

router.use('/system/', SystemRouter);

router.use('/appDefinitions/', AppDefinitionRouter);

router.use('/appData/', AppDataRouter);

module.exports = router;
