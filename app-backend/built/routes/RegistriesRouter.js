"use strict";
const express = require("express");
const BaseApi = require("../api/BaseApi");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const Logger = require("../utils/Logger");
const InjectionExtractor = require("../injection/InjectionExtractor");
const router = express.Router();
router.post('/insert/', function (req, res, next) {
    let registryUser = req.body.registryUser + '';
    let registryPassword = req.body.registryPassword + '';
    let registryDomain = req.body.registryDomain + '';
    let registryImagePrefix = req.body.registryImagePrefix + '';
    const registryHelper = InjectionExtractor.extractUserFromInjected(res).user.serviceManager.getRegistryHelper();
    return Promise.resolve()
        .then(function () {
        return registryHelper.addRegistry(registryUser, registryPassword, registryDomain, registryImagePrefix);
    })
        .then(function () {
        let msg = 'Registry is added.';
        Logger.d(msg);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
router.get('/all/', function (req, res, next) {
    const registryHelper = InjectionExtractor.extractUserFromInjected(res).user.serviceManager.getRegistryHelper();
    let registries = [];
    return Promise.resolve()
        .then(function () {
        return registryHelper.getAllRegistries();
    })
        .then(function (registriesAll) {
        registries = registriesAll;
        return registryHelper.getDefaultPushRegistry();
    })
        .then(function (defaultPush) {
        let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'All registries retrieved');
        baseApi.data = {};
        baseApi.data.registries = registries;
        baseApi.data.defaultPushRegistryId = defaultPush;
        res.send(baseApi);
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
router.post('/delete/', function (req, res, next) {
    let registryId = req.body.registryId + '';
    const registryHelper = InjectionExtractor.extractUserFromInjected(res).user.serviceManager.getRegistryHelper();
    return Promise.resolve()
        .then(function () {
        return registryHelper.deleteRegistry(registryId);
    })
        .then(function () {
        let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Registry deleted');
        res.send(baseApi);
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
router.post('/setpush/', function (req, res, next) {
    let registryId = req.body.registryId + '';
    const registryHelper = InjectionExtractor.extractUserFromInjected(res).user.serviceManager.getRegistryHelper();
    return Promise.resolve()
        .then(function () {
        return registryHelper.setDefaultPushRegistry(registryId);
    })
        .then(function () {
        let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Push Registry changed');
        res.send(baseApi);
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
module.exports = router;
//# sourceMappingURL=RegistriesRouter.js.map