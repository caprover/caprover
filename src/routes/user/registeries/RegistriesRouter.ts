import express = require('express')
import BaseApi = require('../../../api/BaseApi')
import ApiStatusCodes = require('../../../api/ApiStatusCodes')
import Logger = require('../../../utils/Logger')
import InjectionExtractor = require('../../../injection/InjectionExtractor')
import { IRegistryInfo, IRegistryTypes } from '../../../models/IRegistryInfo'

const router = express.Router()

router.get('/', function(req, res, next) {
    const registryHelper = InjectionExtractor.extractUserFromInjected(
        res
    ).user.serviceManager.getRegistryHelper()
    let registries: IRegistryInfo[] = []

    return Promise.resolve()
        .then(function() {
            return registryHelper.getAllRegistries()
        })
        .then(function(registriesAll) {
            registries = registriesAll
            return registryHelper.getDefaultPushRegistryId()
        })
        .then(function(defaultPush) {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'All registries retrieved'
            )
            baseApi.data = {}
            baseApi.data.registries = registries
            baseApi.data.defaultPushRegistryId = defaultPush
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/insert/', function(req, res, next) {
    let registryUser = req.body.registryUser + ''
    let registryPassword = req.body.registryPassword + ''
    let registryDomain = req.body.registryDomain + ''
    let registryImagePrefix = req.body.registryImagePrefix + ''

    const registryHelper = InjectionExtractor.extractUserFromInjected(
        res
    ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function() {
            return registryHelper.addRegistry(
                registryUser,
                registryPassword,
                registryDomain,
                registryImagePrefix,
                IRegistryTypes.REMOTE_REG
            )
        })
        .then(function() {
            let msg = 'Registry is added.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// ERRORS if it's local
router.post('/update/', function(req, res, next) {
    let registryId = req.body.id + ''
    let registryUser = req.body.registryUser + ''
    let registryPassword = req.body.registryPassword + ''
    let registryDomain = req.body.registryDomain + ''
    let registryImagePrefix = req.body.registryImagePrefix + ''

    const registryHelper = InjectionExtractor.extractUserFromInjected(
        res
    ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function() {
            return registryHelper.updateRegistry(
                registryId,
                registryUser,
                registryPassword,
                registryDomain,
                registryImagePrefix
            )
        })
        .then(function() {
            let msg = 'Registry is updated.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// ERRORS if default push is this OR if it's local
router.post('/delete/', function(req, res, next) {
    let registryId = req.body.registryId + ''
    const registryHelper = InjectionExtractor.extractUserFromInjected(
        res
    ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function() {
            return registryHelper.deleteRegistry(registryId, false)
        })
        .then(function() {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Registry deleted'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/setpush/', function(req, res, next) {
    let registryId = req.body.registryId + ''
    const registryHelper = InjectionExtractor.extractUserFromInjected(
        res
    ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function() {
            return registryHelper.setDefaultPushRegistry(registryId)
        })
        .then(function() {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Push Registry changed'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export = router
