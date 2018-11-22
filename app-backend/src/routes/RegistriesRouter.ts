import express = require("express");
import BaseApi = require("../api/BaseApi");
import ApiStatusCodes = require("../api/ApiStatusCodes");
import Logger = require("../utils/Logger");
import CaptainManager = require("../user/CaptainManager");
import Validator = require("validator");
import CaptainConstants = require("../utils/CaptainConstants");

const router = express.Router();

router.post("/insert/", function(req, res, next) {

    let registryUser = req.body.registryUser + "";
    let registryPassword = req.body.registryPassword + "";
    let registryDomain = req.body.registryDomain + "";
    let registryImagePrefix = req.body.registryImagePrefix + "";

    const captainManager = CaptainManager.get();

    return Promise.resolve()
        .then(function() {

            return captainManager.addRegistry(registryUser, registryPassword, registryDomain, registryImagePrefix);

        })
        .then(function() {

            let msg = "Registry is added.";
            Logger.d(msg);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});

router.get("/all/", function(req, res, next) {

    const captainManager = CaptainManager.get();
    let registries: IRegistryInfo[] = [];

    return Promise.resolve()
        .then(function() {

            return captainManager.getAllRegistries();

        })
        .then(function(registriesAll) {

            registries = registriesAll;
            return captainManager.getDefaultPushRegistry();

        })
        .then(function(defaultPush) {


            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "All registries retrieved");
            baseApi.data = {};
            baseApi.data.registries = registries;
            baseApi.data.defaultPushRegistryId = defaultPush;
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });
});

router.post("/delete/", function(req, res, next) {

    let registryId = req.body.registryId + "";
    const captainManager = CaptainManager.get();

    return Promise.resolve()
        .then(function() {

            return captainManager.deleteRegistry(registryId);

        })
        .then(function() {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Registry deleted");
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });
});

router.post("/setpush/", function(req, res, next) {

    let registryId = req.body.registryId + "";
    const captainManager = CaptainManager.get();

    return Promise.resolve()
        .then(function() {

            return captainManager.setDefaultPushRegistry(registryId);

        })
        .then(function() {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Push Registry changed");
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });
});


export = router;