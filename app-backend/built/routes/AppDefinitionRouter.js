"use strict";
const express = require("express");
const fs = require("fs");
const BaseApi = require("../api/BaseApi");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const Logger = require("../utils/Logger");
const router = express.Router();
// Get a list of oneclickspps
router.get('/oneclickapps', function (req, res, next) {
    fs.readdir(__dirname + '/../../dist/oneclick-apps', function (err, files) {
        if (err) {
            Logger.e(err);
            res.sendStatus(500);
            return;
        }
        let ret = [];
        for (let i = 0; i < files.length; i++) {
            if (files[i].endsWith('.js')) {
                ret.push(files[i].substring(0, files[i].length - 3));
            }
        }
        let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'One click app list is fetched.');
        baseApi.data = ret;
        res.send(baseApi);
    });
});
// unused iamges
router.get('/unusedImages', function (req, res, next) {
    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;
    Promise.resolve()
        .then(function () {
        let mostRecentLimit = Number(req.query.mostRecentLimit || '0');
        return serviceManager.getUnusedImages(mostRecentLimit);
    })
        .then(function (unusedImages) {
        let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Unused images retrieved.');
        baseApi.data = {};
        baseApi.data.unusedImages = unusedImages;
        res.send(baseApi);
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
// unused iamges
router.post('/deleteImages', function (req, res, next) {
    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;
    let imageIds = req.body.imageIds || [];
    Promise.resolve()
        .then(function () {
        return serviceManager.deleteImages(imageIds);
    })
        .then(function () {
        let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Images Deleted.');
        res.send(baseApi);
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
// Get All App Definitions
router.get('/', function (req, res, next) {
    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;
    let appsArray = [];
    dataStore
        .getAppsDataStore()
        .getAppDefinitions()
        .then(function (apps) {
        let promises = [];
        Object.keys(apps).forEach(function (key, index) {
            let app = apps[key];
            app.appName = key;
            app.isAppBuilding = serviceManager.isAppBuilding(key);
            app.appPushWebhook = app.appPushWebhook || undefined;
            appsArray.push(app);
        });
        return Promise.all(promises);
    })
        .then(function () {
        return dataStore.getDefaultAppNginxConfig();
    })
        .then(function (defaultNginxConfig) {
        let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'App definitions are retrieved.');
        baseApi.data = appsArray;
        //@ts-ignore
        baseApi.rootDomain = dataStore.getRootDomain();
        //@ts-ignore
        baseApi.defaultNginxConfig = defaultNginxConfig;
        res.send(baseApi);
    })
        .catch(ApiStatusCodes.createCatcher(res));
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
        .catch(ApiStatusCodes.createCatcher(res));
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
        let msg = 'Custom domain is enabled for: ' +
            appName +
            ' at ' +
            customDomain;
        Logger.d(msg);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));
    })
        .catch(ApiStatusCodes.createCatcher(res));
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
        let msg = 'Custom domain is removed for: ' +
            appName +
            ' at ' +
            customDomain;
        Logger.d(msg);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));
    })
        .catch(ApiStatusCodes.createCatcher(res));
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
        let msg = 'Custom domain SSL is enabled for: ' +
            appName +
            ' at ' +
            customDomain;
        Logger.d(msg);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
router.post('/register/', function (req, res, next) {
    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;
    let appName = req.body.appName;
    let hasPersistentData = !!req.body.hasPersistentData;
    let appCreated = false;
    Logger.d('Registering app started: ' + appName);
    dataStore
        .getAppsDataStore()
        .registerAppDefinition(appName, hasPersistentData)
        .then(function () {
        appCreated = true;
    })
        .then(function () {
        return serviceManager.createImage(appName, undefined /*use default dockerfile*/, '');
    })
        .then(function (version) {
        return serviceManager.ensureServiceInitedAndUpdated(appName, version);
    })
        .then(function () {
        Logger.d('AppName is saved: ' + appName);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'App Definition Saved'));
    })
        .catch(function (error) {
        function createRejectionPromise() {
            return new Promise(function (resolve, reject) {
                reject(error);
            });
        }
        if (appCreated) {
            return dataStore
                .getAppsDataStore()
                .deleteAppDefinition(appName)
                .then(function () {
                return createRejectionPromise();
            });
        }
        else {
            return createRejectionPromise();
        }
    })
        .catch(ApiStatusCodes.createCatcher(res));
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
        .catch(ApiStatusCodes.createCatcher(res));
});
router.post('/update/', function (req, res, next) {
    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;
    let appName = req.body.appName;
    let nodeId = req.body.nodeId;
    let notExposeAsWebApp = req.body.notExposeAsWebApp;
    let customNginxConfig = req.body.customNginxConfig;
    let forceSsl = !!req.body.forceSsl;
    let repoInfo = req.body.repoInfo;
    let envVars = req.body.envVars || [];
    let volumes = req.body.volumes || [];
    let ports = req.body.ports || [];
    let instanceCount = req.body.instanceCount || '0';
    let preDeployFunction = req.body.preDeployFunction || '';
    if (repoInfo) {
        if (repoInfo.user) {
            repoInfo.user = repoInfo.user.trim();
        }
        if (repoInfo.repo) {
            repoInfo.repo = repoInfo.repo.trim();
        }
        if (repoInfo.branch) {
            repoInfo.branch = repoInfo.branch.trim();
        }
    }
    Logger.d('Updating app started: ' + appName);
    serviceManager
        .updateAppDefinition(appName, Number(instanceCount), envVars, volumes, nodeId, notExposeAsWebApp, forceSsl, ports, repoInfo, customNginxConfig, preDeployFunction)
        .then(function () {
        Logger.d('AppName is updated: ' + appName);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Updated App Definition Saved'));
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
module.exports = router;
//# sourceMappingURL=AppDefinitionRouter.js.map