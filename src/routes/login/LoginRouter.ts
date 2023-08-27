import express = require('express')
import ApiStatusCodes from '../../api/ApiStatusCodes'
import BaseApi from '../../api/BaseApi'
import DataStoreProvider from '../../datastore/DataStoreProvider'
import InjectionExtractor from '../../injection/InjectionExtractor'
import Authenticator from '../../user/Authenticator'
import {
    CapRoverEventFactory,
    CapRoverEventType,
} from '../../user/events/ICapRoverEvent'
import CaptainConstants from '../../utils/CaptainConstants'
import CircularQueue from '../../utils/CircularQueue'

const router = express.Router()

const failedLoginCircularTimestamps = new CircularQueue<number>(5)

router.post('/', function (req, res, next) {
    const password = `${req.body.password || ''}`
    const otpToken = `${req.body.otpToken || ''}`

    if (!password) {
        const response = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_GENERIC,
            'password is empty.'
        )
        res.send(response)
        return
    }

    let authToken: string

    const namespace =
        InjectionExtractor.extractGlobalsFromInjected(res).namespace
    const userManagerForLoginOnly =
        InjectionExtractor.extractGlobalsFromInjected(
            res
        ).userManagerForLoginOnly
    const otpAuthenticatorForLoginOnly =
        userManagerForLoginOnly.otpAuthenticator
    const eventLoggerForLoginOnly = userManagerForLoginOnly.eventLogger

    let loadedHashedPassword = ''

    Promise.resolve() //
        .then(function () {
            return otpAuthenticatorForLoginOnly.is2FactorEnabled()
        })
        .then(function (isEnabled) {
            if (isEnabled && !otpToken) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_OTP_REQUIRED,
                    'Enter OTP token as well'
                )
            }
        })
        .then(function () {
            const oldestKnownFailedLogin = failedLoginCircularTimestamps.peek()
            if (
                oldestKnownFailedLogin &&
                new Date().getTime() - oldestKnownFailedLogin < 30000
            )
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_PASSWORD_BACK_OFF,
                    'Too many wrong passwords... Wait for 30 seconds and retry.'
                )

            return DataStoreProvider.getDataStore(namespace).getHashedPassword()
        })
        .then(function (savedHashedPassword) {
            loadedHashedPassword = savedHashedPassword
            return Authenticator.getAuthenticator(namespace).getAuthToken(
                { otpToken, otpAuthenticator: otpAuthenticatorForLoginOnly },
                password,
                loadedHashedPassword
            )
        })
        .then(function (token) {
            authToken = token
            return Authenticator.getAuthenticator(
                namespace
            ).getAuthTokenForCookies(
                { otpToken, otpAuthenticator: otpAuthenticatorForLoginOnly },
                password,
                loadedHashedPassword
            )
        })
        .then(function (cookieAuth) {
            res.cookie(CaptainConstants.headerCookieAuth, cookieAuth)
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Login succeeded'
            )
            baseApi.data = { token: authToken }
            eventLoggerForLoginOnly.trackEvent(
                CapRoverEventFactory.create(CapRoverEventType.UserLoggedIn, {
                    ip: req.headers['x-real-ip'] || 'unknown',
                })
            )
            res.send(baseApi)
        })
        .catch(function (err) {
            return new Promise(function (resolve, reject) {
                if (
                    err &&
                    err.captainErrorType &&
                    err.captainErrorType ===
                        ApiStatusCodes.STATUS_WRONG_PASSWORD
                ) {
                    failedLoginCircularTimestamps.push(new Date().getTime())
                }
                reject(err)
            })
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
