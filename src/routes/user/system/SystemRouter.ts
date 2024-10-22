import express = require('express')
import request = require('request')
import validator from 'validator'
import ApiStatusCodes from '../../../api/ApiStatusCodes'
import BaseApi from '../../../api/BaseApi'
import DockerApi from '../../../docker/DockerApi'
import DockerUtils from '../../../docker/DockerUtils'
import InjectionExtractor from '../../../injection/InjectionExtractor'
import { AutomatedCleanupConfigsCleaner } from '../../../models/AutomatedCleanupConfigs'
import CaptainManager from '../../../user/system/CaptainManager'
import VersionManager from '../../../user/system/VersionManager'
import CaptainConstants from '../../../utils/CaptainConstants'
import Logger from '../../../utils/Logger'
import Utils from '../../../utils/Utils'
import SystemRouteSelfHostRegistry from './selfhostregistry/SystemRouteSelfHostRegistry'

const router = express.Router()

router.use('/selfhostregistry/', SystemRouteSelfHostRegistry)

router.post('/createbackup/', function (req, res, next) {
    const backupManager = CaptainManager.get().getBackupManager()

    Promise.resolve()
        .then(function () {
            return backupManager.createBackup(CaptainManager.get())
        })
        .then(function (backupInfo) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Backup created.'
            )
            baseApi.data = backupInfo
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/changerootdomain/', function (req, res, next) {
    const requestedCustomDomain = Utils.removeHttpHttps(
        (req.body.rootDomain || '').toLowerCase()
    )

    if (
        !requestedCustomDomain ||
        requestedCustomDomain.length < 3 ||
        requestedCustomDomain.indexOf('/') >= 0 ||
        requestedCustomDomain.indexOf(':') >= 0 ||
        requestedCustomDomain.indexOf('%') >= 0 ||
        requestedCustomDomain.indexOf(' ') >= 0 ||
        requestedCustomDomain.indexOf('\\') >= 0
    ) {
        res.send(
            new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Bad domain name.')
        )
        return
    }

    CaptainManager.get()
        .changeCaptainRootDomain(requestedCustomDomain, !!req.body.force)
        .then(function () {
            res.send(
                new BaseApi(ApiStatusCodes.STATUS_OK, 'Root domain changed.')
            )
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/enablessl/', function (req, res, next) {
    const emailAddress = req.body.emailAddress || ''

    if (
        !emailAddress ||
        emailAddress.length < 3 ||
        emailAddress.indexOf('/') >= 0 ||
        emailAddress.indexOf(':') >= 0 ||
        emailAddress.indexOf('%') >= 0 ||
        emailAddress.indexOf(' ') >= 0 ||
        emailAddress.indexOf('\\') >= 0 ||
        !validator.isEmail(emailAddress)
    ) {
        res.send(
            new BaseApi(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Bad email address.'
            )
        )
        return
    }

    CaptainManager.get()
        .enableSsl(emailAddress)
        .then(function () {
            // This is necessary as the CLI immediately tries to connect to https://captain.root.com
            // Without this delay it'll fail to connect
            Logger.d('Waiting for 7 seconds...')
            return Utils.getDelayedPromise(7000)
        })
        .then(function () {
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Root SSL Enabled.'))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/forcessl/', function (req, res, next) {
    const isEnabled = !!req.body.isEnabled

    CaptainManager.get()
        .forceSsl(isEnabled)
        .then(function () {
            res.send(
                new BaseApi(
                    ApiStatusCodes.STATUS_OK,
                    `Non-SSL traffic is now ${
                        isEnabled ? 'rejected.' : 'allowed.'
                    }`
                )
            )
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/info/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    return Promise.resolve()
        .then(function () {
            return dataStore.getHasRootSsl()
        })
        .then(function (hasRootSsl) {
            return {
                hasRootSsl: hasRootSsl,
                forceSsl: CaptainManager.get().getForceSslValue(),
                rootDomain: dataStore.hasCustomDomain()
                    ? dataStore.getRootDomain()
                    : '',
                captainSubDomain: CaptainConstants.configs.captainSubDomain,
            }
        })
        .then(function (data) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Captain info retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/loadbalancerinfo/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
            return CaptainManager.get().getLoadBalanceManager().getInfo()
        })
        .then(function (data) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Load Balancer info retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/versionInfo/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
            return VersionManager.get().getCaptainImageTags()
        })
        .then(function (data) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Version Info Retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/versionInfo/', function (req, res, next) {
    const latestVersion = req.body.latestVersion
    const registryHelper =
        InjectionExtractor.extractUserFromInjected(
            res
        ).user.serviceManager.getRegistryHelper()

    return Promise.resolve()
        .then(function () {
            return VersionManager.get().updateCaptain(
                latestVersion,
                registryHelper
            )
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Captain update process has started...'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/diskcleanup/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
            return CaptainManager.get().getDiskCleanupManager().getConfigs()
        })
        .then(function (data) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Disk cleanup configs retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/diskcleanup/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
            const configs = AutomatedCleanupConfigsCleaner.sanitizeInput({
                mostRecentLimit: req.body.mostRecentLimit,
                cronSchedule: req.body.cronSchedule,
                timezone: req.body.timezone,
            })
            return CaptainManager.get()
                .getDiskCleanupManager()
                .setConfig(configs)
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Disk cleanup configs updated'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/netdata/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    return Promise.resolve()
        .then(function () {
            return dataStore.getNetDataInfo()
        })
        .then(function (data) {
            data.netDataUrl = `${
                CaptainConstants.configs.captainSubDomain
            }.${dataStore.getRootDomain()}${
                CaptainConstants.netDataRelativePath
            }`
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Netdata info retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/netdata/', function (req, res, next) {
    const netDataInfo = req.body.netDataInfo
    netDataInfo.netDataUrl = undefined // Frontend app returns this value, but we really don't wanna save this.
    // root address is subject to change.

    return Promise.resolve()
        .then(function () {
            return CaptainManager.get().updateNetDataInfo(netDataInfo)
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Netdata info is updated'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/goaccess/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    const goAccessInfo = dataStore.getGoAccessInfo()

    return Promise.resolve()
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'GoAccess info retrieved'
            )
            baseApi.data = goAccessInfo
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/goaccess/', function (req, res, next) {
    const goAccessInfo = req.body.goAccessInfo
    // goAccessInfo.netDataUrl = undefined // Frontend app returns this value, but we really don't wanna save this.
    // // root address is subject to change.

    return Promise.resolve()
        .then(function () {
            return CaptainManager.get().updateGoAccessInfo(goAccessInfo)
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'GoAccess info is updated'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/goaccess/:appName/files', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    const goAccessInfo = dataStore.getGoAccessInfo()

    const appName = req.params.appName

    if (!appName) {
        const baseApi = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_GENERIC,
            'Invalid appName'
        )
        baseApi.data = []
        res.send(baseApi)
        return
    }

    if (!goAccessInfo.isEnabled) {
        const baseApi = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_GENERIC,
            'GoAccess not enabled'
        )
        baseApi.data = []
        res.send(baseApi)
        return
    }

    let appDefinition: IAppDef

    return Promise.resolve()
        .then(function () {
            // Ensure a valid appName parameter
            return dataStore.getAppsDataStore().getAppDefinition(appName)
        })
        .then(function (resolvedAppDefinition) {
            appDefinition = resolvedAppDefinition

            // Request the autoindex file that has all the generated reports
            const url = `http://${CaptainConstants.nginxServiceName}/goaccess`

            return new Promise<string[]>(function (resolve, reject) {
                request(url, function (error, response, body) {
                    if (error || !body) {
                        Logger.e(`Error        ${error}`)
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                'Request to list goaccess files Failed.'
                            )
                        )
                        return
                    }

                    const lines = body.split('\n')
                    const linkRegex = /\<a href=\"(.*?)\"/g

                    const data = []

                    for (const line of lines) {
                        const match = linkRegex.exec(line)
                        if (match) {
                            data.push(match[1])
                        }
                    }

                    resolve(data)
                })
            })
        })
        .then(function (linkData) {
            //Filter to just the generated files for the particular app
            const customDomains = appDefinition.customDomain.map(
                (d) => d.publicDomain
            )
            console.log('Filtering link data', {
                linkData,
                appName,
                customDomains,
            })
            return linkData.filter(
                (l) =>
                    (l.startsWith(appName) ||
                        customDomains.some((d) => l.startsWith(d))) &&
                    l.endsWith('.html')
            )
        })
        .then(function (linkData) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'GoAccess info retrieved'
            )
            baseApi.data = linkData
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/nginxconfig/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
            return CaptainManager.get().getNginxConfig()
        })
        .then(function (data) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Nginx config retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/nginxconfig/', function (req, res, next) {
    const baseConfigCustomValue = req.body.baseConfig.customValue
    const captainConfigCustomValue = req.body.captainConfig.customValue

    return Promise.resolve()
        .then(function () {
            return CaptainManager.get().setNginxConfig(
                baseConfigCustomValue,
                captainConfigCustomValue
            )
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Nginx config is updated'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/nodes/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
            return CaptainManager.get().getNodesInfo()
        })
        .then(function (data) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Node info retrieved'
            )
            baseApi.data = { nodes: data }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/nodes/', function (req, res, next) {
    const MANAGER = 'manager'
    const WORKER = 'worker'
    const registryHelper =
        InjectionExtractor.extractUserFromInjected(
            res
        ).user.serviceManager.getRegistryHelper()

    let isManager: boolean

    if (req.body.nodeType === MANAGER) {
        isManager = true
    } else if (req.body.nodeType === WORKER) {
        isManager = false
    } else {
        res.send(
            new BaseApi(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Node type should be either manager or worker'
            )
        )
        return
    }

    const privateKey = req.body.privateKey
    const remoteNodeIpAddress = req.body.remoteNodeIpAddress
    const captainIpAddress = req.body.captainIpAddress
    const sshPort = parseInt(req.body.sshPort) || 22
    const sshUser = (req.body.sshUser || 'root').trim()

    if (!captainIpAddress || !remoteNodeIpAddress || !privateKey) {
        res.send(
            new BaseApi(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Private Key, Captain IP address, remote IP address and remote username should all be present'
            )
        )
        return
    }

    return Promise.resolve()
        .then(function () {
            return registryHelper.getDefaultPushRegistryId()
        })
        .then(function (defaultRegistry) {
            if (!defaultRegistry) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    'There is no default Docker Registry. You need a repository for your images before adding nodes. Read docs.'
                )
            }
        })
        .then(function () {
            return DockerUtils.joinDockerNode(
                DockerApi.get(),
                sshUser,
                sshPort,
                captainIpAddress,
                isManager,
                remoteNodeIpAddress,
                privateKey
            )
        })
        .then(function () {
            const msg = 'Docker node is successfully joined.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
