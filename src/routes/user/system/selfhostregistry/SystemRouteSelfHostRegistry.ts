import express = require('express')
import BaseApi = require('../../../../api/BaseApi')
import ApiStatusCodes = require('../../../../api/ApiStatusCodes')
import Logger = require('../../../../utils/Logger')
import CaptainManager = require('../../../../user/system/CaptainManager')
import Validator = require('validator')
import CaptainConstants = require('../../../../utils/CaptainConstants')
import InjectionExtractor = require('../../../../injection/InjectionExtractor')
import uuid = require('uuid/v4')
import { IRegistryTypes } from '../../../../models/IRegistryInfo'

const router = express.Router()

// ERRORS if a local already exists in DB
router.post('/enableregistry/', function(req, res, next) {
    const captainManager = CaptainManager.get()
    const password = uuid()
    const registryHelper = InjectionExtractor.extractUserFromInjected(
        res
    ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function() {
            return CaptainManager.get()
                .getDockerRegistry()
                .enableRegistrySsl()
        })
        .then(function() {
            return captainManager
                .getDockerRegistry()
                .ensureDockerRegistryRunningOnThisNode(password)
        })
        .then(function() {
            return registryHelper.getAllRegistries()
        })
        .then(function(allRegs) {
            for (let index = 0; index < allRegs.length; index++) {
                const element = allRegs[index]
                if (element.registryType === IRegistryTypes.LOCAL_REG) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'There is already a local registry set up!'
                    )
                }
            }
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

// ERRORS if default push is this
router.post('/disableregistry/', function(req, res, next) {
    const captainManager = CaptainManager.get()
    const registryHelper = InjectionExtractor.extractUserFromInjected(
        res
    ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function() {
            return registryHelper.getAllRegistries()
        })
        .then(function(regs) {
            let localRegistryId = ''
            for (let idx = 0; idx < regs.length; idx++) {
                const element = regs[idx]
                if (element.registryType === IRegistryTypes.LOCAL_REG) {
                    localRegistryId = element.id
                }
            }

            return registryHelper.deleteRegistry(localRegistryId, true)
        })
        .then(function() {
            return captainManager.getDockerRegistry().ensureServiceRemoved()
        })
        .then(function() {
            let msg = 'Local registry is removed.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export = router
