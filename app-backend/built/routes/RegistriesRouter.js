var express = require('express');
var router = express.Router();
var BaseApi = require('../api/BaseApi');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var Logger = require('../utils/Logger');
var CaptainManager = require('../user/CaptainManager');
var Validator = require('validator');
var CaptainConstants = require('../utils/CaptainConstants');
router.post('/insert/', function (req, res, next) {
    var registryUser = req.body.registryUser + '';
    var registryPassword = req.body.registryPassword + '';
    var registryDomain = req.body.registryDomain + '';
    var registryImagePrefix = req.body.registryImagePrefix + '';
    var captainManager = CaptainManager.get();
    return Promise.resolve()
        .then(function () {
        return captainManager.addRegistry(registryUser, registryPassword, registryDomain, registryImagePrefix);
    })
        .then(function () {
        var msg = 'Registry is added.';
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
router.get('/all/', function (req, res, next) {
    var captainManager = CaptainManager.get();
    var registries = [];
    return Promise.resolve()
        .then(function () {
        return captainManager.getAllRegistries();
    })
        .then(function (registriesAll) {
        registries = registriesAll;
        return captainManager.getDefaultPushRegistry();
    })
        .then(function (defaultPush) {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'All registries retrieved');
        baseApi.registries = registries;
        baseApi.defaultPushRegistryId = defaultPush;
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
router.post('/delete/', function (req, res, next) {
    var registryId = req.body.registryId + '';
    var captainManager = CaptainManager.get();
    return Promise.resolve()
        .then(function () {
        return captainManager.deleteRegistry(registryId);
    })
        .then(function () {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Registry deleted');
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
router.post('/setpush/', function (req, res, next) {
    var registryId = req.body.registryId + '';
    var captainManager = CaptainManager.get();
    return Promise.resolve()
        .then(function () {
        return captainManager.setDefaultPushRegistry(registryId);
    })
        .then(function () {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Push Registry changed');
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
module.exports = router;
