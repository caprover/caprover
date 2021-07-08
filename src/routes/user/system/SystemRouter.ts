import express = require('express')
import validator from 'validator'
import ApiStatusCodes from '../../../api/ApiStatusCodes'
import BaseApi from '../../../api/BaseApi'
import DockerApi from '../../../docker/DockerApi'
import DockerUtils from '../../../docker/DockerUtils'
import InjectionExtractor from '../../../injection/InjectionExtractor'
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
    let requestedCustomDomain = Utils.removeHttpHttps(
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
    let isEnabled = !!req.body.isEnabled

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
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore

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
            }
        })
        .then(function (data) {
            let baseApi = new BaseApi(
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
            let baseApi = new BaseApi(
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
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Version Info Retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/versionInfo/', function (req, res, next) {
    let latestVersion = req.body.latestVersion

    return Promise.resolve()
        .then(function () {
            return VersionManager.get().updateCaptain(latestVersion)
        })
        .then(function () {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Captain update process has started...'
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/netdata/', function (req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore

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
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Netdata info retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/netdata/', function (req, res, next) {
    let netDataInfo = req.body.netDataInfo
    netDataInfo.netDataUrl = undefined // Frontend app returns this value, but we really don't wanna save this.
    // root address is subject to change.

    return Promise.resolve()
        .then(function () {
            return CaptainManager.get().updateNetDataInfo(netDataInfo)
        })
        .then(function () {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Netdata info is updated'
            )
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
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Nginx config retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/nginxconfig/', function (req, res, next) {
    let baseConfigCustomValue = req.body.baseConfig.customValue
    let captainConfigCustomValue = req.body.captainConfig.customValue

    return Promise.resolve()
        .then(function () {
            return CaptainManager.get().setNginxConfig(
                baseConfigCustomValue,
                captainConfigCustomValue
            )
        })
        .then(function () {
            let baseApi = new BaseApi(
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
            let baseApi = new BaseApi(
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
    const registryHelper = InjectionExtractor.extractUserFromInjected(
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

    let privateKey = req.body.privateKey
    let remoteNodeIpAddress = req.body.remoteNodeIpAddress
    let captainIpAddress = req.body.captainIpAddress
    let sshPort = parseInt(req.body.sshPort) || 22
    let sshUser = (req.body.sshUser || 'root').trim()

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
            let msg = 'Docker node is successfully joined.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
