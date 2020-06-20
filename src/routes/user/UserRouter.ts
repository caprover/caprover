import express = require('express')
import BaseApi = require('../../api/BaseApi')
import ApiStatusCodes = require('../../api/ApiStatusCodes')
import Injector = require('../../injection/Injector')
import SystemRouter = require('./system/SystemRouter')
import AppsRouter = require('./apps/AppsRouter')
import OneClickAppRouter = require('./apps/oneclick/OneClickAppRouter')
import Logger = require('../../utils/Logger')
import RegistriesRouter = require('./registeries/RegistriesRouter')
import onFinished = require('on-finished')
import InjectionExtractor = require('../../injection/InjectionExtractor')
import CaptainManager = require('../../user/system/CaptainManager')
import Utils from '../../utils/Utils'
import EnvVars = require('../../utils/EnvVars')
import Authenticator = require('../../user/Authenticator')

const router = express.Router()

const threadLockNamespace = {} as IHashMapGeneric<boolean>

router.use('/apps/webhooks/', Injector.injectUserForWebhook())

router.use(Injector.injectUser())

router.use(function(req, res, next) {
    const user = InjectionExtractor.extractUserFromInjected(res).user

    if (!user) {
        let response = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_NOT_AUTHORIZED,
            'The request is not authorized.'
        )
        res.send(response)
        return
    }

    if (!user.initialized) {
        let response = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_USER_NOT_INITIALIZED,
            'User data is being loaded... Please wait...'
        )
        res.send(response)
        return
    }

    const namespace = user.namespace

    if (!namespace) {
        let response = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_NOT_AUTHORIZED,
            'Cannot find the namespace attached to this user'
        )
        res.send(response)
        return
    }

    // All requests except GET might be making changes to some stuff that are not designed for an asynchronous process
    // I'm being extra cautious. But removal of this lock mechanism requires testing and consideration of edge cases.
    if (Utils.isNotGetRequest(req)) {
        if (!!EnvVars.DEMO_MODE_ADMIN_IP) {
            const realIp = `${req.headers['x-real-ip']}`
            const forwardedIp = `${req.headers['x-forwarded-for']}`
            if (
                !realIp ||
                !Utils.isValidIp(realIp) ||
                realIp !== forwardedIp ||
                EnvVars.DEMO_MODE_ADMIN_IP !== realIp
            ) {
                let response = new BaseApi(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    'Demo mode is only for viewing purposes.'
                )
                res.send(response)

                return
            }
        }

        if (threadLockNamespace[namespace]) {
            // Changed to HTTP status code so that the webhook and 3rd party services can understand this.
            res.status(429)
            res.send('Another operation still in progress... please wait...')
            return
        }

        // we don't want the same space to go under two simultaneous changes
        threadLockNamespace[namespace] = true
        onFinished(res, function() {
            threadLockNamespace[namespace] = false
        })
    }

    next()
})

router.post('/changepassword/', function(req, res, next) {
    const namespace = InjectionExtractor.extractUserFromInjected(res).user
        .namespace
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore

    Promise.resolve() //
        .then(function(data) {
            return dataStore.getHashedPassword()
        })
        .then(function(savedHashedPassword) {
            return Authenticator.getAuthenticator(namespace).changepass(
                req.body.oldPassword,
                req.body.newPassword,
                savedHashedPassword
            )
        })
        .then(function(hashedPassword) {
            return dataStore.setHashedPassword(hashedPassword)
        })
        .then(function() {
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Password changed.'))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.use('/apps/', AppsRouter)

router.use('/oneclick/', OneClickAppRouter)

router.use('/registries/', RegistriesRouter)

router.use('/system/', SystemRouter)

export = router
