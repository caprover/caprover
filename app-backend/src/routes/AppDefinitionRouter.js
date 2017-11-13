const express = require('express');
const router = express.Router();
const BaseApi = require('../api/BaseApi');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const Logger = require('../utils/Logger');

// Get All App Definitions
router.get('/', function (req, res, next) {

    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;

    dataStore.getAppDefinitions()
        .then(function (apps) {

            let appsArray = [];

            Object.keys(apps).forEach(function (key, index) {
                let app = apps[key];
                app.appName = key;
                app.isAppBuilding = serviceManager.isAppBuilding(key);
                appsArray.push(app);
            });

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "App definitions are retrieved.");
            baseApi.data = appsArray;
            baseApi.rootDomain = dataStore.getRootDomain();

            res.send(baseApi);
        })
        .catch(function (error) {
            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });
});

router.post('/enablebasedomainssl/', function (req, res, next) {
    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;

    const appName = req.body.appName;

    return Promise.resolve()
        .then(function () {

            return serviceManager.enableSslForApp(appName);

        })
        .then(function () {

            let msg = 'General SSL is enabled for: ' + appName;
            Logger.d(msg);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));

        })
        .catch(function (error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});


router.post('/customdomain/', function (req, res, next) {

    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;

    let appName = req.body.appName;
    let customDomain = (req.body.customDomain || '').toLowerCase();

    // verify customdomain.com going through the default NGINX
    // Add customdomain.com to app in Data Store

    return Promise.resolve()
        .then(function () {

            return serviceManager.addCustomDomain(appName, customDomain);

        })
        .then(function () {

            let msg = 'Custom domain is enabled for: ' + appName + ' at ' + customDomain;
            Logger.d(msg);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));

        })
        .catch(function (error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});


router.post('/removecustomdomain/', function (req, res, next) {

    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;

    let appName = req.body.appName;
    let customDomain = (req.body.customDomain || '').toLowerCase();

    return Promise.resolve()
        .then(function () {

            return serviceManager.removeCustomDomain(appName, customDomain);

        })
        .then(function () {

            let msg = 'Custom domain is removed for: ' + appName + ' at ' + customDomain;
            Logger.d(msg);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));

        })
        .catch(function (error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});


router.post('/enablecustomdomainssl/', function (req, res, next) {

    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;

    let appName = req.body.appName;
    let customDomain = (req.body.customDomain || '').toLowerCase();

    // Check if customdomain is already associated with app. If not, error out.
    // Verify customdomain.com is served from /customdomain.com/

    return Promise.resolve()
        .then(function () {

            return serviceManager.enableCustomDomainSsl(appName, customDomain);

        })
        .then(function () {

            let msg = 'Custom domain SSL is enabled for: ' + appName + ' at ' + customDomain;
            Logger.d(msg);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));

        })
        .catch(function (error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});

router.post('/register/', function (req, res, next) {

    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;

    let appName = req.body.appName;
    let hasPersistentData = !!req.body.hasPersistentData;

    Logger.d('Registering app started: ' + appName);

    dataStore.registerAppDefinition(appName, hasPersistentData)
        .then(function () {

            return serviceManager.createImage(appName);

        })
        .then(function (version) {

            return serviceManager.ensureServiceInitedAndUpdated(appName, version);

        })
        .then(function () {

            Logger.d('AppName is saved: ' + appName);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'App Definition Saved'));

        })
        .catch(function (error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);

        });

});

router.post('/delete/', function (req, res, next) {

    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;

    let appName = req.body.appName;

    Logger.d('Deleting app started: ' + appName);

    Promise.resolve()
        .then(function () {

            return serviceManager.removeApp(appName);

        })
        .then(function () {

            Logger.d('AppName is deleted: ' + appName);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'App is deleted'));

        })
        .catch(function (error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);

        });
});

router.post('/update/', function (req, res, next) {

    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;

    let appName = req.body.appName;
    let nodeId = req.body.nodeId;
    let envVars = req.body.envVars || [];
    let volumes = req.body.volumes || [];
    let instanceCount = req.body.instanceCount || '0';

    Logger.d('Updating app started: ' + appName);

    serviceManager.updateAppDefinition(appName, Number(instanceCount), envVars, volumes, nodeId)
        .then(function () {

            Logger.d('AppName is updated: ' + appName);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Updated App Definition Saved'));

        })
        .catch(function (error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);

        });

});

module.exports = router;
