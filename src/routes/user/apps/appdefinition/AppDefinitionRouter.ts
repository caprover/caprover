import express = require('express')
import ApiStatusCodes from '../../../../api/ApiStatusCodes'
import BaseApi from '../../../../api/BaseApi'
import {
    getAllAppDefinitions,
    registerAppDefinition,
    updateAppDefinition,
} from '../../../../handlers/users/apps/appdefinition/AppDefinitionHandler'
import InjectionExtractor from '../../../../injection/InjectionExtractor'
import { AppDeployTokenConfig } from '../../../../models/AppDefinition'
import CaptainManager from '../../../../user/system/CaptainManager'
import Logger from '../../../../utils/Logger'
import Utils from '../../../../utils/Utils'

const router = express.Router()

// unused images
router.get('/unusedImages', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
            const mostRecentLimit = Number(req.query.mostRecentLimit || '0')
            return CaptainManager.get()
                .getDiskCleanupManager()
                .getUnusedImages(mostRecentLimit)
        })
        .then(function (unusedImages) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Unused images retrieved.'
            )
            baseApi.data = {}
            baseApi.data.unusedImages = unusedImages

            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// delete images
router.post('/deleteImages', function (req, res, next) {
    const imageIds = req.body.imageIds || []

    return Promise.resolve()
        .then(function () {
            return CaptainManager.get()
                .getDiskCleanupManager()
                .deleteImages(imageIds)
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Images Deleted.'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// Get All App Definitions
router.get('/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    return getAllAppDefinitions(dataStore, serviceManager)
        .then(function (result) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                result.message
            )
            baseApi.data = result.data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/enablebasedomainssl/', function (req, res, next) {
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    const appName = req.body.appName

    return Promise.resolve()
        .then(function () {
            return serviceManager.enableSslForApp(appName)
        })
        .then(function () {
            const msg = `General SSL is enabled for: ${appName}`
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/customdomain/', function (req, res, next) {
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    const appName = req.body.appName
    const customDomain = (req.body.customDomain || '').toLowerCase().trim()

    // verify customdomain.com going through the default NGINX
    // Add customdomain.com to app in Data Store

    return Promise.resolve()
        .then(function () {
            return serviceManager.addCustomDomain(appName, customDomain)
        })
        .then(function () {
            const msg = `Custom domain is enabled for: ${appName} at ${customDomain}`
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/removecustomdomain/', function (req, res, next) {
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    const appName = req.body.appName
    const customDomain = (req.body.customDomain || '').toLowerCase()

    return Promise.resolve()
        .then(function () {
            return serviceManager.removeCustomDomain(appName, customDomain)
        })
        .then(function () {
            const msg = `Custom domain is removed for: ${appName} at ${customDomain}`
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/enablecustomdomainssl/', function (req, res, next) {
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    const appName = req.body.appName
    const customDomain = (req.body.customDomain || '').toLowerCase()

    // Check if customdomain is already associated with app. If not, error out.
    // Verify customdomain.com is served from /customdomain.com/

    return Promise.resolve()
        .then(function () {
            return serviceManager.enableCustomDomainSsl(appName, customDomain)
        })
        .then(function () {
            const msg = `Custom domain SSL is enabled for: ${appName} at ${customDomain} `
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/register/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    const appName = req.body.appName as string
    const projectId = `${req.body.projectId || ''}`
    const hasPersistentData = !!req.body.hasPersistentData
    const isDetachedBuild = !!req.query.detached

    return registerAppDefinition(
        { appName, projectId, hasPersistentData, isDetachedBuild },
        dataStore,
        serviceManager
    )
        .then(function (result) {
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, result.message))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/delete/', function (req, res, next) {
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    const appName: string = req.body.appName
    const volumes: string[] = req.body.volumes || []
    const appNames: string[] = req.body.appNames || []
    const appsToDelete: string[] = appNames.length ? appNames : [appName]

    Logger.d(`Deleting app started: ${appName}`)

    return Promise.resolve()
        .then(function () {
            if (appNames.length > 0 && appName) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_OPERATION,
                    'Either appName or appNames should be provided'
                )
            }
        })
        .then(function () {
            return serviceManager.removeApps(appsToDelete)
        })
        .then(function () {
            return Utils.getDelayedPromise(volumes.length ? 12000 : 0)
        })
        .then(function () {
            return serviceManager.removeVolsSafe(volumes)
        })
        .then(function (failedVolsToRemoved) {
            Logger.d(`Successfully deleted: ${appsToDelete.join(', ')}`)

            if (failedVolsToRemoved.length) {
                const returnVal = new BaseApi(
                    ApiStatusCodes.STATUS_OK_PARTIALLY,
                    `App is deleted. Some volumes were not safe to delete. Delete skipped for: ${failedVolsToRemoved.join(
                        ' , '
                    )}`
                )
                returnVal.data = { volumesFailedToDelete: failedVolsToRemoved }
                res.send(returnVal)
            } else {
                res.send(
                    new BaseApi(ApiStatusCodes.STATUS_OK, 'App is deleted')
                )
            }
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/rename/', function (req, res, next) {
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    const oldAppName = req.body.oldAppName + ''
    const newAppName = req.body.newAppName + ''

    Logger.d(`Renaming app started: From ${oldAppName} To ${newAppName} `)

    return Promise.resolve()
        .then(function () {
            return serviceManager.renameApp(oldAppName, newAppName)
        })
        .then(function () {
            Logger.d('AppName is renamed')
            res.send(
                new BaseApi(ApiStatusCodes.STATUS_OK, 'AppName is renamed')
            )
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// Update app configs
router.post('/update/', function (req, res, next) {
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    const appName = req.body.appName
    const projectId = req.body.projectId
    const nodeId = req.body.nodeId
    const captainDefinitionRelativeFilePath =
        req.body.captainDefinitionRelativeFilePath
    const notExposeAsWebApp = req.body.notExposeAsWebApp
    const tags = req.body.tags
    const customNginxConfig = req.body.customNginxConfig
    const forceSsl = req.body.forceSsl
    const websocketSupport = req.body.websocketSupport
    const repoInfo = req.body.appPushWebhook
        ? req.body.appPushWebhook.repoInfo
        : undefined
    const envVars = req.body.envVars
    const volumes = req.body.volumes
    const ports = req.body.ports
    const instanceCount = req.body.instanceCount
    const redirectDomain = req.body.redirectDomain
    const preDeployFunction = req.body.preDeployFunction
    const serviceUpdateOverride = req.body.serviceUpdateOverride
    const containerHttpPort = req.body.containerHttpPort
    const httpAuth = req.body.httpAuth
    const appDeployTokenConfig = req.body.appDeployTokenConfig as
        | AppDeployTokenConfig
        | undefined
    const description = req.body.description

    return updateAppDefinition(
        {
            appName,
            projectId,
            description,
            instanceCount,
            captainDefinitionRelativeFilePath,
            envVars,
            volumes,
            tags,
            nodeId,
            notExposeAsWebApp,
            containerHttpPort,
            httpAuth,
            forceSsl,
            ports,
            repoInfo,
            customNginxConfig,
            redirectDomain,
            preDeployFunction,
            serviceUpdateOverride,
            websocketSupport,
            appDeployTokenConfig,
        },
        serviceManager
    )
        .then(function (result) {
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, result.message))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
