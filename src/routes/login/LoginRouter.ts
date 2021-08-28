import express = require('express')
import ApiStatusCodes from '../../api/ApiStatusCodes'
import BaseApi from '../../api/BaseApi'
import DataStoreProvider from '../../datastore/DataStoreProvider'
import InjectionExtractor from '../../injection/InjectionExtractor'
import Authenticator from '../../user/Authenticator'
import CaptainConstants from '../../utils/CaptainConstants'
import CircularQueue from '../../utils/CircularQueue'

const router = express.Router()

const failedLoginCircularTimestamps = new CircularQueue<number>(5)

router.post('/', function (req, res, next) {
    let password = req.body.password || ''

    if (!password) {
        let response = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_GENERIC,
            'password is empty.'
        )
        res.send(response)
        return
    }

    let authToken: string

    const namespace =
        InjectionExtractor.extractGlobalsFromInjected(res).namespace

    let loadedHashedPassword = ''

    Promise.resolve() //
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
                password,
                loadedHashedPassword
            )
        })
        .then(function (token) {
            authToken = token
            return Authenticator.getAuthenticator(
                namespace
            ).getAuthTokenForCookies(password, loadedHashedPassword)
        })
        .then(function (cookieAuth) {
            res.cookie(CaptainConstants.headerCookieAuth, cookieAuth)
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Login succeeded'
            )
            baseApi.data = { token: authToken }
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
