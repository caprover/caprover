import express = require('express')
import ApiStatusCodes from '../../../../api/ApiStatusCodes'
import BaseApi from '../../../../api/BaseApi'
import InjectionExtractor from '../../../../injection/InjectionExtractor'
import { AppDeployTokenConfig, IAppDef } from '../../../../models/AppDefinition'
import { CaptainError } from '../../../../models/OtherTypes'
import CaptainManager from '../../../../user/system/CaptainManager'
import CaptainConstants from '../../../../utils/CaptainConstants'
import Logger from '../../../../utils/Logger'
import Utils from '../../../../utils/Utils'

const router = express.Router()

const DEFAULT_APP_CAPTAIN_DEFINITION = JSON.stringify({
    schemaVersion: 2,
    dockerfileLines: [
        `FROM ${CaptainConstants.configs.appPlaceholderImageName}`,
    ],
})

// unused images
router.get('/unusedImages', function (req, res, next) {
    Promise.resolve()
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

    Promise.resolve()
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
    const appsArray: IAppDef[] = []

    dataStore
        .getAppsDataStore()
        .getAppDefinitions()
        .then(function (apps) {
            const promises: Promise<void>[] = []

            Object.keys(apps).forEach(function (key, index) {
                const app = apps[key]
                app.appName = key
                app.isAppBuilding = serviceManager.isAppBuilding(key)
                app.appPushWebhook = app.appPushWebhook || undefined
                appsArray.push(app)
            })

            return Promise.all(promises)
        })
        .then(function () {
            return dataStore.getDefaultAppNginxConfig()
        })
        .then(function (defaultNginxConfig) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App definitions are retrieved.'
            )
            baseApi.data = {
                appDefinitions: appsArray,
                rootDomain: dataStore.getRootDomain(),
                captainSubDomain: CaptainConstants.configs.captainSubDomain,
                defaultNginxConfig: defaultNginxConfig,
            }

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

    let appCreated = false

    Logger.d(`Registering app started: ${appName}`)

    return Promise.resolve()
        .then(function () {
            if (projectId) {
                return dataStore.getProjectsDataStore().getProject(projectId)
                // if project is not found, it will throw an error
            }
        })
        .then(function () {
            return dataStore
                .getAppsDataStore()
                .registerAppDefinition(appName, projectId, hasPersistentData)
        })
        .then(function () {
            appCreated = true
        })
        .then(function () {
            const promiseToIgnore = serviceManager
                .scheduleDeployNewVersion(appName, {
                    captainDefinitionContentSource: {
                        captainDefinitionContent:
                            DEFAULT_APP_CAPTAIN_DEFINITION,
                        gitHash: '',
                    },
                })
                .catch(function (error) {
                    Logger.e(error)
                })

            if (!isDetachedBuild) return promiseToIgnore
        })
        .then(function () {
            Logger.d(`AppName is saved: ${appName}`)
            res.send(
                new BaseApi(ApiStatusCodes.STATUS_OK, 'App Definition Saved')
            )
        })
        .catch(function (error: CaptainError) {
            function createRejectionPromise() {
                return new Promise<void>(function (resolve, reject) {
                    reject(error)
                })
            }

            if (appCreated) {
                return dataStore
                    .getAppsDataStore()
                    .deleteAppDefinition(appName)
                    .then(function () {
                        return createRejectionPromise()
                    })
            } else {
                return createRejectionPromise()
            }
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

    Promise.resolve()
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

    Promise.resolve()
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

router.post('/update/', function (req, res, next) {
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    const appName = req.body.appName
    const projectId = req.body.projectId
    const nodeId = req.body.nodeId
    const captainDefinitionRelativeFilePath =
        req.body.captainDefinitionRelativeFilePath
    const notExposeAsWebApp = req.body.notExposeAsWebApp
    const tags = req.body.tags || []
    const customNginxConfig = req.body.customNginxConfig
    const forceSsl = !!req.body.forceSsl
    const websocketSupport = !!req.body.websocketSupport
    const repoInfo = req.body.appPushWebhook
        ? req.body.appPushWebhook.repoInfo || {}
        : {}
    const envVars = req.body.envVars || []
    const volumes = req.body.volumes || []
    const ports = req.body.ports || []
    const instanceCount = req.body.instanceCount || '0'
    const redirectDomain = req.body.redirectDomain || ''
    const preDeployFunction = req.body.preDeployFunction || ''
    const serviceUpdateOverride = req.body.serviceUpdateOverride || ''
    const containerHttpPort = Number(req.body.containerHttpPort) || 80
    const httpAuth = req.body.httpAuth
    let appDeployTokenConfig = req.body.appDeployTokenConfig as
        | AppDeployTokenConfig
        | undefined
    const description = req.body.description || ''

    if (!appDeployTokenConfig) {
        appDeployTokenConfig = { enabled: false }
    } else {
        appDeployTokenConfig = {
            enabled: !!appDeployTokenConfig.enabled,
            appDeployToken: `${
                appDeployTokenConfig.appDeployToken
                    ? appDeployTokenConfig.appDeployToken
                    : ''
            }`.trim(),
        }
    }

    if (repoInfo.user) {
        repoInfo.user = repoInfo.user.trim()
    }
    if (repoInfo.repo) {
        repoInfo.repo = repoInfo.repo.trim()
    }
    if (repoInfo.branch) {
        repoInfo.branch = repoInfo.branch.trim()
    }

    if (
        (repoInfo.branch ||
            repoInfo.user ||
            repoInfo.repo ||
            repoInfo.password ||
            repoInfo.sshKey) &&
        (!repoInfo.branch ||
            !repoInfo.repo ||
            (!repoInfo.sshKey && !repoInfo.user && !repoInfo.password) ||
            (repoInfo.password && !repoInfo.user) ||
            (repoInfo.user && !repoInfo.password))
    ) {
        res.send(
            new BaseApi(
                ApiStatusCodes.ILLEGAL_PARAMETER,
                'Missing required Github/BitBucket/Gitlab field'
            )
        )
        return
    }

    if (
        repoInfo &&
        repoInfo.sshKey &&
        repoInfo.sshKey.indexOf('ENCRYPTED') > 0 &&
        !CaptainConstants.configs.disableEncryptedCheck
    ) {
        res.send(
            new BaseApi(
                ApiStatusCodes.ILLEGAL_PARAMETER,
                'You cannot use encrypted SSH keys'
            )
        )
        return
    }

    if (
        repoInfo &&
        repoInfo.sshKey &&
        repoInfo.sshKey.indexOf('END OPENSSH PRIVATE KEY-----') > 0
    ) {
        repoInfo.sshKey = repoInfo.sshKey.trim()
        repoInfo.sshKey = repoInfo.sshKey + '\n'
    }

    Logger.d(`Updating app started: ${appName}`)

    serviceManager
        .updateAppDefinition(
            appName,
            projectId,
            description,
            Number(instanceCount),
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
            appDeployTokenConfig
        )
        .then(function () {
            Logger.d(`AppName is updated: ${appName}`)
            res.send(
                new BaseApi(
                    ApiStatusCodes.STATUS_OK,
                    'Updated App Definition Saved'
                )
            )
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
