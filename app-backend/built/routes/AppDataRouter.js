var express = require('express');
var router = express.Router();
var BaseApi = require('../api/BaseApi');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var Logger = require('../utils/Logger');
var multer = require('multer');
var fs = require('fs-extra');
var TEMP_UPLOAD = 'temp_upload/';
var upload = multer({ dest: TEMP_UPLOAD });
router.get('/:appName/', function (req, res, next) {
    var appName = req.params.appName;
    var serviceManager = res.locals.user.serviceManager;
    return Promise.resolve()
        .then(function () {
        return serviceManager.getBuildStatus(appName);
    })
        .then(function (data) {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'App build status retrieved');
        baseApi.data = data;
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
router.post('/:appName/', function (req, res, next) {
    var dataStore = res.locals.user.dataStore;
    var appName = req.params.appName;
    dataStore.getAppsDataStore().getAppDefinitions()
        .then(function (apps) {
        if (!apps[appName]) {
            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "App not found: " + appName + "! Make sure your app is created before deploy!");
        }
        next();
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
router.post('/:appName/', upload.single('sourceFile'), function (req, res, next) {
    var dataStore = res.locals.user.dataStore;
    var serviceManager = res.locals.user.serviceManager;
    var appName = req.params.appName;
    var isDetachedBuild = !!req.query.detached;
    var captainDefinitionContent = req.body.captainDefinitionContent;
    var gitHash = req.body.gitHash || '';
    var tarballSourceFilePath = (!!req.file) ? req.file.path : null;
    if ((!!tarballSourceFilePath && !!captainDefinitionContent) || (!tarballSourceFilePath && !captainDefinitionContent)) {
        res.send(new BaseApi(ApiStatusCodes.ILLEGAL_OPERATION, "Either tarballfile or captainDefinitionContent should be present."));
        return;
    }
    Promise.resolve()
        .then(function () {
        if (captainDefinitionContent) {
            for (var i = 0; i < 1000; i++) {
                var tempPath = __dirname + '/../../' + TEMP_UPLOAD + appName + i;
                if (!fs.pathExistsSync(tempPath)) {
                    tarballSourceFilePath = tempPath;
                    break;
                }
            }
            if (!tarballSourceFilePath) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Cannot create a temp file! Something is seriously wrong with the temp folder");
            }
            return serviceManager.createTarFarFromCaptainContent(captainDefinitionContent, appName, tarballSourceFilePath);
        }
    })
        .then(function () {
        if (isDetachedBuild) {
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK_DEPLOY_STARTED, 'Deploy is started'));
            startBuildProcess()
                .catch(function (error) {
                Logger.e(error);
            });
        }
        else {
            return startBuildProcess()
                .then(function () {
                res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Deploy is done'));
            });
        }
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        if (!error) {
            error = new Error('ERROR: NULL');
        }
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, error.stack + ''));
        try {
            fs.removeSync(tarballSourceFilePath);
        }
        catch (ignore) {
        }
    });
    function startBuildProcess() {
        return serviceManager
            .createImage(appName, {
            pathToSrcTarballFile: tarballSourceFilePath
        }, gitHash)
            .then(function (version) {
            fs.removeSync(tarballSourceFilePath);
            return version;
        })
            .catch(function (error) {
            return new Promise(function (resolve, reject) {
                fs.removeSync(tarballSourceFilePath);
                reject(error);
            });
        })
            .then(function (version) {
            return serviceManager.ensureServiceInitedAndUpdated(appName, version);
        })
            .catch(function (error) {
            return new Promise(function (resolve, reject) {
                serviceManager.logBuildFailed(appName, error);
                reject(error);
            });
        });
    }
});
module.exports = router;
