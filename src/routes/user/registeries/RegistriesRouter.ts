import express = require('express')
import ApiStatusCodes from '../../../api/ApiStatusCodes'
import BaseApi from '../../../api/BaseApi'
import InjectionExtractor from '../../../injection/InjectionExtractor'
import { IRegistryInfo, IRegistryTypes } from '../../../models/IRegistryInfo'
import Logger from '../../../utils/Logger'

const router = express.Router()

router.get('/', function (req, res, next) {
    const registryHelper =
        InjectionExtractor.extractUserFromInjected(
            res
        ).user.serviceManager.getRegistryHelper()
    let registries: IRegistryInfo[] = []

    return Promise.resolve()
        .then(function () {
            return registryHelper.getAllRegistries()
        })
        .then(function (registriesAll) {
            registries = registriesAll
            return registryHelper.getDefaultPushRegistryId()
        })
        .then(function (defaultPush) {
            const baseApi = new BaseApi(
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

router.post('/insert/', function (req, res, next) {
    const registryUser = req.body.registryUser + ''
    const registryPassword = req.body.registryPassword + ''
    const registryDomain = req.body.registryDomain + ''
    const registryImagePrefix = req.body.registryImagePrefix + ''

    const registryHelper =
        InjectionExtractor.extractUserFromInjected(
            res
        ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function () {
            return registryHelper.addRegistry(
                registryUser,
                registryPassword,
                registryDomain,
                registryImagePrefix,
                IRegistryTypes.REMOTE_REG
            )
        })
        .then(function () {
            const msg = 'Registry is added.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// ERRORS if it's local
router.post('/update/', function (req, res, next) {
    const registryId = req.body.id + ''
    const registryUser = req.body.registryUser + ''
    const registryPassword = req.body.registryPassword + ''
    const registryDomain = req.body.registryDomain + ''
    const registryImagePrefix = req.body.registryImagePrefix + ''

    const registryHelper =
        InjectionExtractor.extractUserFromInjected(
            res
        ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function () {
            return registryHelper.updateRegistry(
                registryId,
                registryUser,
                registryPassword,
                registryDomain,
                registryImagePrefix
            )
        })
        .then(function () {
            const msg = 'Registry is updated.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// ERRORS if default push is this OR if it's local
router.post('/delete/', function (req, res, next) {
    const registryId = req.body.registryId + ''
    const registryHelper =
        InjectionExtractor.extractUserFromInjected(
            res
        ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function () {
            return registryHelper.deleteRegistry(registryId, false)
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Registry deleted'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/setpush/', function (req, res, next) {
    const registryId = req.body.registryId + ''
    const registryHelper =
        InjectionExtractor.extractUserFromInjected(
            res
        ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function () {
            return registryHelper.setDefaultPushRegistry(registryId)
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Push Registry changed'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
