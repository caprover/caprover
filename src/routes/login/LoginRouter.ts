import { AuthenticationResponseJSON } from '@simplewebauthn/server'
import express = require('express')
import ApiStatusCodes from '../../api/ApiStatusCodes'
import BaseApi from '../../api/BaseApi'
import DataStoreProvider from '../../datastore/DataStoreProvider'
import InjectionExtractor from '../../injection/InjectionExtractor'
import Authenticator from '../../user/Authenticator'
import PasskeyManager, {
    PASSKEY_CHALLENGE_TTL_MS,
} from '../../user/PasskeyManager'
import {
    CapRoverEventFactory,
    CapRoverEventType,
} from '../../user/events/ICapRoverEvent'
import CaptainConstants from '../../utils/CaptainConstants'
import CircularQueue from '../../utils/CircularQueue'
import IpRateLimiter from '../../utils/IpRateLimiter'

const router = express.Router()

const failedLoginCircularTimestamps = new CircularQueue<number>(5)

// Shared by password and passkey login: failures of either count towards the same back-off.
function throwIfLoginBackedOff() {
    const oldestKnownFailedLogin = failedLoginCircularTimestamps.peek()
    if (
        oldestKnownFailedLogin &&
        new Date().getTime() - oldestKnownFailedLogin < 30000
    )
        throw ApiStatusCodes.createError(
            ApiStatusCodes.STATUS_PASSWORD_BACK_OFF,
            'Too many wrong passwords... Wait for 30 seconds and retry.'
        )
}

const PASSKEY_LOGIN_COOKIE = 'captainPasskeyLogin'
const passkeyOptionsRateLimiter = new IpRateLimiter(10, 60 * 1000)

/**
 * captain-nginx overwrites X-Real-IP with $remote_addr, so behind it this is
 * the real client. Requests that reach the published admin port directly
 * (IP:3000) bypass nginx and can set this header themselves; the global cap
 * on pending challenges still bounds them.
 */
function getClientIp(req: express.Request) {
    const realIp = req.headers['x-real-ip']
    return `${(Array.isArray(realIp) ? realIp[0] : realIp) || req.socket.remoteAddress || 'unknown'}`
}

function recordFailedLogin(err: any) {
    if (
        err &&
        err.captainErrorType &&
        err.captainErrorType === ApiStatusCodes.STATUS_WRONG_PASSWORD
    ) {
        failedLoginCircularTimestamps.push(new Date().getTime())
    }
}

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

    // if password is more than 29 characters, return error
    if (password.length > 29) {
        const response = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_GENERIC,
            'password is too long - maximum 29 characters. If you had previously set a password longer than 29 characters, please use the first 29 characters.'
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
            throwIfLoginBackedOff()

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
                recordFailedLogin(err)
                reject(err)
            })
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/passkey/options/', function (req, res, next) {
    const namespace =
        InjectionExtractor.extractGlobalsFromInjected(res).namespace

    Promise.resolve() //
        .then(function () {
            throwIfLoginBackedOff()
            if (!passkeyOptionsRateLimiter.isAllowed(getClientIp(req))) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_PASSWORD_BACK_OFF,
                    'Too many passkey login attempts... Wait a minute and retry.'
                )
            }
            return new PasskeyManager(
                DataStoreProvider.getDataStore(namespace)
            ).getAuthenticationOptions()
        })
        .then(function (result) {
            res.cookie(PASSKEY_LOGIN_COOKIE, result.sessionId, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                maxAge: PASSKEY_CHALLENGE_TTL_MS,
                path: req.baseUrl || '/',
            })
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Passkey options generated'
            )
            baseApi.data = result.options
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/passkey/verify/', function (req, res, next) {
    const otpToken = `${req.body.otpToken || ''}`
    const passkeyResponse = req.body.response as AuthenticationResponseJSON
    const passkeySessionId = `${req.cookies?.[PASSKEY_LOGIN_COOKIE] || ''}`

    const namespace =
        InjectionExtractor.extractGlobalsFromInjected(res).namespace
    const userManagerForLoginOnly =
        InjectionExtractor.extractGlobalsFromInjected(
            res
        ).userManagerForLoginOnly
    const otpAuthenticatorForLoginOnly =
        userManagerForLoginOnly.otpAuthenticator
    const eventLoggerForLoginOnly = userManagerForLoginOnly.eventLogger
    const authenticator = Authenticator.getAuthenticator(namespace)

    let authToken: string

    res.clearCookie(PASSKEY_LOGIN_COOKIE, { path: req.baseUrl || '/' })

    Promise.resolve() //
        .then(function () {
            throwIfLoginBackedOff()
            return otpAuthenticatorForLoginOnly.is2FactorEnabled()
        })
        .then(function (isEnabled) {
            if (isEnabled && !otpToken) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_OTP_REQUIRED,
                    'Enter OTP token as well'
                )
            }

            if (!passkeyResponse || typeof passkeyResponse !== 'object') {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'Passkey response is missing'
                )
            }

            return new PasskeyManager(
                DataStoreProvider.getDataStore(namespace)
            ).verifyAuthentication(passkeySessionId, passkeyResponse)
        })
        .then(function () {
            // only reached with a valid passkey; OTP is still enforced when 2FA is on
            return otpAuthenticatorForLoginOnly.isOtpTokenValid(otpToken)
        })
        .then(function (otpValid) {
            if (!otpValid) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_WRONG_PASSWORD,
                    'Invalid credentials'
                )
            }
            return authenticator.getAuthTokenForVerifiedPasskey()
        })
        .then(function (token) {
            authToken = token
            return authenticator.getAuthTokenForCookiesForVerifiedPasskey()
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
                recordFailedLogin(err)
                reject(err)
            })
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
