const express = require('express');
const router = express.Router();
const BaseApi = require('../api/BaseApi');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const Logger = require('../utils/Logger');
const multer = require('multer');
const fs = require('fs-extra');
const TEMP_UPLOAD = 'temp_upload/';
const upload = multer({dest: TEMP_UPLOAD});


router.get('/:appName/', function (req, res, next) {

    let appName = req.params.appName;
    let serviceManager = res.locals.user.serviceManager;

    return Promise.resolve()
        .then(function () {

            return serviceManager.getBuildStatus(appName);

        })
        .then(function (data) {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'App build status retrieved');
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

    let dataStore = res.locals.user.dataStore;
    let appName = req.params.appName;

    dataStore.getAppDefinitions()
        .then(function (apps) {
            if (!apps[appName]) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC,
                    "App not found: " + appName + "! Make sure your app is created before deploy!");
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

    let dataStore = res.locals.user.dataStore;
    let serviceManager = res.locals.user.serviceManager;
    let isDetachedBuild = !!req.query.detached;
    console.log('---------------' + JSON.stringify(req.query));

    let appName = req.params.appName;

    let tarballSourceFilePath = (!!req.file) ? req.file.path : null;
    const captainDefinitionContent = req.body.captainDefinitionContent;


    if ((tarballSourceFilePath && captainDefinitionContent) || (!tarballSourceFilePath && !captainDefinitionContent)) {
        res.send(new BaseApi(ApiStatusCodes.ILLEGAL_OPERATION), "Either tarballfile or captainDefinitionContent should be present.");
        return;
    }

    let gitHash = req.body.gitHash || '';

    Promise.resolve()
        .then(function () {

            if (captainDefinitionContent) {

                if (tarballSourceFilePath) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_OPERATION, "Both tarballfile & captainDefinitionContent cannot be present at the same time.")
                }

                for (let i = 0; i < 1000; i++) {
                    let tempPath = __dirname + '/../../' + TEMP_UPLOAD + appName + i;
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
            else {

                if (!tarballSourceFilePath) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_OPERATION, "Either tarballfile or captainDefinitionContent should be present.")
                }
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
            } catch (ignore) {
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
                })

            })
            .then(function (version) {

                return serviceManager.ensureServiceInitedAndUpdated(appName, version);

            })
            .catch(function (error) {

                return new Promise(function (resolve, reject) {
                    serviceManager.logBuildFailed(appName, error);
                    reject(error);
                })

            });
    }
});

module.exports = router;
