var express = require('express');
var fs = require('fs');
var router = express.Router();
var BaseApi = require('../api/BaseApi');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var Logger = require('../utils/Logger');
var Authenticator = require('../user/Authenticator');
// Get a list of oneclickspps
router.get('/oneclickapps', function (req, res, next) {
    fs.readdir(__dirname + '/../../dist/oneclick-apps', function (err, files) {
        if (err) {
            Logger.e(err);
            res.sendStatus(500);
            return;
        }
        var ret = [];
        for (var i = 0; i < files.length; i++) {
            if (files[i].endsWith('.js')) {
                ret.push(files[i].substring(0, files[i].length - 3));
            }
        }
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "One click app list is fetched.");
        baseApi.data = ret;
        res.send(baseApi);
    });
});
// unused iamges
router.get('/unusedImages', function (req, res, next) {
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    Promise.resolve()
        .then(function () {
        var mostRecentLimit = Number(req.query.mostRecentLimit || '0');
        return serviceManager.getUnusedImages(mostRecentLimit);
    })
        .then(function (unusedImages) {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Unused images retrieved.");
        baseApi.data = {};
        baseApi.data.unusedImages = unusedImages;
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
// unused iamges
router.post('/deleteImages', function (req, res, next) {
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    var imageIds = req.body.imageIds || [];
    Promise.resolve()
        .then(function () {
        return serviceManager.deleteImages(imageIds);
    })
        .then(function () {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Images Deleted.");
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
// Get All App Definitions
router.get('/', function (req, res, next) {
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    var appsArray = [];
    dataStore.getAppsDataStore().getAppDefinitions()
        .then(function (apps) {
        var promises = [];
        Object.keys(apps).forEach(function (key, index) {
            var app = apps[key];
            app.appName = key;
            app.isAppBuilding = serviceManager.isAppBuilding(key);
            app.appPushWebhook = app.appPushWebhook || {};
            var repoInfoEncrypted = app.appPushWebhook ? app.appPushWebhook.repoInfo : null;
            if (repoInfoEncrypted) {
                promises.push(Authenticator.get(dataStore.getNameSpace())
                    .decodeAppPushWebhookDatastore(repoInfoEncrypted)
                    .then(function (decryptedData) {
                    app.appPushWebhook.repoInfo = decryptedData;
                }));
            }
            else {
                app.appPushWebhook.repoInfo = {};
            }
            appsArray.push(app);
        });
        return Promise.all(promises);
    })
        .then(function () {
        return dataStore.getDefaultAppNginxConfig();
    })
        .then(function (defaultNginxConfig) {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "App definitions are retrieved.");
        baseApi.data = appsArray;
        baseApi.rootDomain = dataStore.getRootDomain();
        baseApi.defaultNginxConfig = defaultNginxConfig;
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
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    var appName = req.body.appName;
    return Promise.resolve()
        .then(function () {
        return serviceManager.enableSslForApp(appName);
    })
        .then(function () {
        var msg = 'General SSL is enabled for: ' + appName;
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
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    var appName = req.body.appName;
    var customDomain = (req.body.customDomain || '').toLowerCase();
    // verify customdomain.com going through the default NGINX
    // Add customdomain.com to app in Data Store
    return Promise.resolve()
        .then(function () {
        return serviceManager.addCustomDomain(appName, customDomain);
    })
        .then(function () {
        var msg = 'Custom domain is enabled for: ' + appName + ' at ' + customDomain;
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
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    var appName = req.body.appName;
    var customDomain = (req.body.customDomain || '').toLowerCase();
    return Promise.resolve()
        .then(function () {
        return serviceManager.removeCustomDomain(appName, customDomain);
    })
        .then(function () {
        var msg = 'Custom domain is removed for: ' + appName + ' at ' + customDomain;
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
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    var appName = req.body.appName;
    var customDomain = (req.body.customDomain || '').toLowerCase();
    // Check if customdomain is already associated with app. If not, error out.
    // Verify customdomain.com is served from /customdomain.com/
    return Promise.resolve()
        .then(function () {
        return serviceManager.enableCustomDomainSsl(appName, customDomain);
    })
        .then(function () {
        var msg = 'Custom domain SSL is enabled for: ' + appName + ' at ' + customDomain;
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
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    var appName = req.body.appName;
    var hasPersistentData = !!req.body.hasPersistentData;
    var appCreated = false;
    Logger.d('Registering app started: ' + appName);
    dataStore.getAppsDataStore().registerAppDefinition(appName, hasPersistentData)
        .then(function () {
        appCreated = true;
    })
        .then(function () {
        return serviceManager.createImage(appName, { /*use default dockerfile*/});
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
            return dataStore.getAppsDataStore().deleteAppDefinition(appName)
                .then(function () {
                return createRejectionPromise();
            });
        }
        else {
            return createRejectionPromise();
        }
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
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    var appName = req.body.appName;
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
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    var appName = req.body.appName;
    var nodeId = req.body.nodeId;
    var notExposeAsWebApp = req.body.notExposeAsWebApp;
    var customNginxConfig = req.body.customNginxConfig;
    var forceSsl = !!req.body.forceSsl;
    var appPushWebhook = req.body.appPushWebhook || {};
    var envVars = req.body.envVars || [];
    var volumes = req.body.volumes || [];
    var ports = req.body.ports || [];
    var instanceCount = req.body.instanceCount || '0';
    var preDeployFunction = req.body.preDeployFunction || '';
    if (appPushWebhook.repoInfo) {
        if (appPushWebhook.repoInfo.user) {
            appPushWebhook.repoInfo.user = appPushWebhook.repoInfo.user.trim();
        }
        if (appPushWebhook.repoInfo.repo) {
            appPushWebhook.repoInfo.repo = appPushWebhook.repoInfo.repo.trim();
        }
        if (appPushWebhook.repoInfo.branch) {
            appPushWebhook.repoInfo.branch = appPushWebhook.repoInfo.branch.trim();
        }
    }
    Logger.d('Updating app started: ' + appName);
    serviceManager.updateAppDefinition(appName, Number(instanceCount), envVars, volumes, nodeId, notExposeAsWebApp, forceSsl, ports, appPushWebhook, customNginxConfig, preDeployFunction)
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
