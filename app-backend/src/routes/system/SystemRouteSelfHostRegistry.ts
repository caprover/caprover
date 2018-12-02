import express = require('express')
import BaseApi = require('../../api/BaseApi')
import ApiStatusCodes = require('../../api/ApiStatusCodes')
import Logger = require('../../utils/Logger')
import CaptainManager = require('../../user/CaptainManager')
import Validator = require('validator')
import CaptainConstants = require('../../utils/CaptainConstants')
import InjectionExtractor = require('../../injection/InjectionExtractor')
import uuid = require('uuid/v4')

const router = express.Router()

router.post('/enableregistryssl/', function(req, res, next) {
    return Promise.resolve()
        .then(function() {
            return CaptainManager.get()
                .getDockerRegistry()
                .enableRegistrySsl()
        })
        .then(function() {
            let msg = 'General SSL is enabled for docker registry.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/enableregistry/', function(req, res, next) {
    const captainManager = CaptainManager.get()
    const password = uuid()
    const registryHelper = InjectionExtractor.extractAppAndUserForWebhook(
        res
    ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function() {
            return captainManager
                .getDockerRegistry()
                .ensureDockerRegistryRunningOnThisNode(password)
        })
        .then(function() {
            let user = CaptainConstants.captainRegistryUsername
            let domain = captainManager
                .getDockerRegistry()
                .getLocalRegistryDomainAndPort()

            return registryHelper.addRegistry(
                user,
                password,
                domain,
                user,
                IRegistryTypes.LOCAL_REG
            )
        })
        .then(function() {
            let msg = 'Local registry is created.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export = router
