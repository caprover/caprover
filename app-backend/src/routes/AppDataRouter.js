const express = require('express');
const router = express.Router();
const BaseApi = require('../api/BaseApi');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const Logger = require('../utils/Logger');
const multer = require('multer');
const fs = require('fs-extra');
const upload = multer({dest: 'temp_upload/'});

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

    const tarballSourceFilePath = req.file.path;
    let gitHash = req.body.gitHash || '';

    serviceManager.createImage(appName, tarballSourceFilePath, gitHash)
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
