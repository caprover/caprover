const express = require('express');
const router = express.Router();
const BaseApi = require('../api/BaseApi');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const Logger = require('../utils/Logger');
const multer = require('multer');
const fs = require('fs-extra');
const TEMP_UPLOAD = 'temp_upload/';
const upload = multer({dest: TEMP_UPLOAD});

router.post('/:appName/', function (req, res, next) {

    let dataStore = res.locals.user.dataStore;
    let appName = req.params.appName;

    dataStore.getAppDefinitions()
        .then(function (apps) {
            if (!apps[appName]) {
                throw new Error('App not found!');
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

    let appName = req.params.appName;

    if (!req.file) {
        res.sendStatus(500);
        return;
    }

    let tarballSourceFilePath = req.file.path;
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
                    let tempPath = __dirname + '../' + TEMP_UPLOAD + appName + i;
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

            return serviceManager.createImage(appName, tarballSourceFilePath, gitHash);

        })
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
        .then(function () {

            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'App Data Saved'));

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
