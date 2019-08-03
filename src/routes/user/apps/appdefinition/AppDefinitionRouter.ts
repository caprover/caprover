import express = require('express')
import fs = require('fs')
import BaseApi = require('../../../../api/BaseApi')
import ApiStatusCodes = require('../../../../api/ApiStatusCodes')
import Logger = require('../../../../utils/Logger')
import CaptainConstants = require('../../../../utils/CaptainConstants')
import { CaptainError } from '../../../../models/OtherTypes'
import InjectionExtractor = require('../../../../injection/InjectionExtractor')
import Utils from '../../../../utils/Utils'

const router = express.Router()

const DEFAULT_APP_CAPTAIN_DEFINITION = JSON.stringify({
    schemaVersion: 2,
    dockerfileLines: [
        'FROM ' + CaptainConstants.configs.appPlaceholderImageName,
    ],
})

// Get a list of oneclickspps
router.get('/oneclickapps', function(req, res, next) {
    fs.readdir(__dirname + '/../../dist/oneclick-apps', function(err, files) {
        if (err) {
            Logger.e(err)
            res.sendStatus(500)
            return
        }

        let ret = []

        for (let i = 0; i < files.length; i++) {
            if (files[i].endsWith('.js')) {
                ret.push(files[i].substring(0, files[i].length - 3))
            }
        }

        let baseApi = new BaseApi(
            ApiStatusCodes.STATUS_OK,
            'One click app list is fetched.'
        )
        baseApi.data = ret

        res.send(baseApi)
    })
})

// unused iamges
router.get('/unusedImages', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    Promise.resolve()
        .then(function() {
            let mostRecentLimit = Number(req.query.mostRecentLimit || '0')
            return serviceManager.getUnusedImages(mostRecentLimit)
        })
        .then(function(unusedImages) {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Unused images retrieved.'
            )
            baseApi.data = {}
            baseApi.data.unusedImages = unusedImages

            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// unused iamges
router.post('/deleteImages', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager
    let imageIds = req.body.imageIds || []

    Promise.resolve()
        .then(function() {
            return serviceManager.deleteImages(imageIds)
        })
        .then(function() {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Images Deleted.'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// Get All App Definitions
router.get('/', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager
    let appsArray: IAppDef[] = []

    dataStore
        .getAppsDataStore()
        .getAppDefinitions()
        .then(function(apps) {
            let promises: Promise<void>[] = []

            Object.keys(apps).forEach(function(key, index) {
                let app = apps[key]
                app.appName = key
                app.isAppBuilding = serviceManager.isAppBuilding(key)
                app.appPushWebhook = app.appPushWebhook || undefined
                appsArray.push(app)
            })

            return Promise.all(promises)
        })
        .then(function() {
            return dataStore.getDefaultAppNginxConfig()
        })
        .then(function(defaultNginxConfig) {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App definitions are retrieved.'
            )
            baseApi.data = {
                appDefinitions: appsArray,
                rootDomain: dataStore.getRootDomain(),
                defaultNginxConfig: defaultNginxConfig,
            }

            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/enablebasedomainssl/', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    const appName = req.body.appName

    return Promise.resolve()
        .then(function() {
            return serviceManager.enableSslForApp(appName)
        })
        .then(function() {
            let msg = 'General SSL is enabled for: ' + appName
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/customdomain/', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    let appName = req.body.appName
    let customDomain = (req.body.customDomain || '').toLowerCase()

    // verify customdomain.com going through the default NGINX
    // Add customdomain.com to app in Data Store

    return Promise.resolve()
        .then(function() {
            return serviceManager.addCustomDomain(appName, customDomain)
        })
        .then(function() {
            let msg =
                'Custom domain is enabled for: ' +
                appName +
                ' at ' +
                customDomain
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/removecustomdomain/', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    let appName = req.body.appName
    let customDomain = (req.body.customDomain || '').toLowerCase()

    return Promise.resolve()
        .then(function() {
            return serviceManager.removeCustomDomain(appName, customDomain)
        })
        .then(function() {
            let msg =
                'Custom domain is removed for: ' +
                appName +
                ' at ' +
                customDomain
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/enablecustomdomainssl/', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    let appName = req.body.appName
    let customDomain = (req.body.customDomain || '').toLowerCase()

    // Check if customdomain is already associated with app. If not, error out.
    // Verify customdomain.com is served from /customdomain.com/

    return Promise.resolve()
        .then(function() {
            return serviceManager.enableCustomDomainSsl(appName, customDomain)
        })
        .then(function() {
            let msg = `Custom domain SSL is enabled for: ${appName} at ${customDomain} `
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/register/', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    let appName = req.body.appName as string
    let hasPersistentData = !!req.body.hasPersistentData

    let appCreated = false

    Logger.d('Registering app started: ' + appName)

    dataStore
        .getAppsDataStore()
        .registerAppDefinition(appName, hasPersistentData)
        .then(function() {
            appCreated = true
        })
        .then(function() {
            return serviceManager.scheduleDeployNewVersion(appName, {
                captainDefinitionContentSource: {
                    captainDefinitionContent: DEFAULT_APP_CAPTAIN_DEFINITION,
                    gitHash: '',
                },
            })
        })
        .then(function() {
            Logger.d('AppName is saved: ' + appName)
            res.send(
                new BaseApi(ApiStatusCodes.STATUS_OK, 'App Definition Saved')
            )
        })
        .catch(function(error: CaptainError) {
            function createRejectionPromise() {
                return new Promise<void>(function(resolve, reject) {
                    reject(error)
                })
            }

            if (appCreated) {
                return dataStore
                    .getAppsDataStore()
                    .deleteAppDefinition(appName)
                    .then(function() {
                        return createRejectionPromise()
                    })
            } else {
                return createRejectionPromise()
            }
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/delete/', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    let appName = req.body.appName
    let volumes = req.body.volumes || []

    Logger.d('Deleting app started: ' + appName)

    Promise.resolve()
        .then(function() {
            return serviceManager.removeApp(appName)
        })
        .then(function() {
            return Utils.getDelayedPromise(volumes.length ? 12000 : 0)
        })
        .then(function() {
            return serviceManager.removeVolsSafe(volumes)
        })
        .then(function(failedVolsToRemoved) {
            Logger.d('AppName is deleted: ' + appName)

            if (failedVolsToRemoved.length) {
                const returnVal = new BaseApi(
                    ApiStatusCodes.STATUS_OK_PARTIALLY,
                    'App is deleted. Some volumes were not safe to delete. Delete skipped for: ' +
                        failedVolsToRemoved.join(' , ')
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

router.post('/update/', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    let appName = req.body.appName
    let nodeId = req.body.nodeId
    let captainDefinitionRelativeFilePath =
        req.body.captainDefinitionRelativeFilePath
    let notExposeAsWebApp = req.body.notExposeAsWebApp
    let customNginxConfig = req.body.customNginxConfig
    let forceSsl = !!req.body.forceSsl
    let repoInfo = !!req.body.appPushWebhook
        ? req.body.appPushWebhook.repoInfo || {}
        : {}
    let envVars = req.body.envVars || []
    let volumes = req.body.volumes || []
    let ports = req.body.ports || []
    let instanceCount = req.body.instanceCount || '0'
    let preDeployFunction = req.body.preDeployFunction || ''
    let containerHttpPort = Number(req.body.containerHttpPort) || 80
    let httpAuth = req.body.httpAuth
    let description = req.body.description || ''

    if (repoInfo.user) {
        repoInfo.user = repoInfo.user.trim()
    }
    if (repoInfo.repo) {
        repoInfo.repo = repoInfo.repo.trim()
    }
    if (repoInfo.branch) {
        repoInfo.branch = repoInfo.branch.trim()
    }

    Logger.d('Updating app started: ' + appName)

    serviceManager
        .updateAppDefinition(
            appName,
            description,
            Number(instanceCount),
            captainDefinitionRelativeFilePath,
            envVars,
            volumes,
            nodeId,
            notExposeAsWebApp,
            containerHttpPort,
            httpAuth,
            forceSsl,
            ports,
            repoInfo,
            customNginxConfig,
            preDeployFunction
        )
        .then(function() {
            Logger.d('AppName is updated: ' + appName)
            res.send(
                new BaseApi(
                    ApiStatusCodes.STATUS_OK,
                    'Updated App Definition Saved'
                )
            )
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export = router
