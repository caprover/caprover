"use strict";
const express = require("express");
const BaseApi = require("../../api/BaseApi");
const ApiStatusCodes = require("../../api/ApiStatusCodes");
const Logger = require("../../utils/Logger");
const CaptainManager = require("../../user/system/CaptainManager");
const CaptainConstants = require("../../utils/CaptainConstants");
const InjectionExtractor = require("../../injection/InjectionExtractor");
const uuid = require("uuid/v4");
const router = express.Router();
router.post('/enableregistry/', function (req, res, next) {
    const captainManager = CaptainManager.get();
    const password = uuid();
    const registryHelper = InjectionExtractor.extractAppAndUserForWebhook(res).user.serviceManager.getRegistryHelper();
    return Promise.resolve()
        .then(function () {
        return CaptainManager.get()
            .getDockerRegistry()
            .enableRegistrySsl();
    })
        .then(function () {
        return captainManager
            .getDockerRegistry()
            .ensureDockerRegistryRunningOnThisNode(password);
    })
        .then(function () {
        let user = CaptainConstants.captainRegistryUsername;
        let domain = captainManager
            .getDockerRegistry()
            .getLocalRegistryDomainAndPort();
        return registryHelper.addRegistry(user, password, domain, user, IRegistryTypes.LOCAL_REG);
    })
        .then(function () {
        let msg = 'Local registry is created.';
        Logger.d(msg);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
router.post('/disableregistry/', function (req, res, next) {
    const captainManager = CaptainManager.get();
    const registryHelper = InjectionExtractor.extractAppAndUserForWebhook(res).user.serviceManager.getRegistryHelper();
    let localRegistryId = '';
    return Promise.resolve()
        .then(function () {
        return registryHelper.getAllRegistries();
    })
        .then(function (regs) {
        for (let idx = 0; idx < regs.length; idx++) {
            const element = regs[idx];
            if (element.registryType == IRegistryTypes.LOCAL_REG) {
                // If local is already removed, localRegistryId will be empty even after this for loop
                localRegistryId = element.id;
            }
        }
        return registryHelper.getDefaultPushRegistryId();
    })
        .then(function (defaultId) {
        if (!!defaultId && defaultId === localRegistryId) {
            throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_OPERATION, 'Cannot remove DEFAULT PUSH registry. First demote from default, then delete');
        }
        return captainManager.getDockerRegistry().ensureServiceRemoved();
    })
        .then(function () {
        if (localRegistryId) {
            return registryHelper.deleteRegistry(localRegistryId);
        }
    })
        .then(function () {
        let msg = 'Local registry is removed.';
        Logger.d(msg);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
module.exports = router;
//# sourceMappingURL=SystemRouteSelfHostRegistry.js.map