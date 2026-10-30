import { RegistrationResponseJSON } from '@simplewebauthn/server'
import express = require('express')
import ApiStatusCodes from '../../api/ApiStatusCodes'
import BaseApi from '../../api/BaseApi'
import DataStore from '../../datastore/DataStore'
import InjectionExtractor from '../../injection/InjectionExtractor'
import Authenticator from '../../user/Authenticator'
import PasskeyManager from '../../user/PasskeyManager'

const router = express.Router()

// A stolen session alone must not be enough to plant a permanent login.
function checkCurrentPassword(
    namespace: string,
    dataStore: DataStore,
    password: unknown
) {
    return Promise.resolve()
        .then(function () {
            return dataStore.getHashedPassword()
        })
        .then(function (savedHashedPassword) {
            return Authenticator.getAuthenticator(namespace).isPasswordCorrect(
                `${password || ''}`,
                savedHashedPassword
            )
        })
        .then(function (isPasswordCorrect) {
            if (!isPasswordCorrect) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_WRONG_PASSWORD,
                    'Password is incorrect.'
                )
            }
        })
}

router.get('/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    new PasskeyManager(dataStore)
        .getPasskeys()
        .then(function (passkeys) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Passkeys retrieved'
            )
            baseApi.data = { passkeys }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/register/options/', function (req, res, next) {
    const user = InjectionExtractor.extractUserFromInjected(res).user
    const dataStore = user.dataStore

    // checked here too, so a wrong password fails before the browser creates a credential
    checkCurrentPassword(user.namespace, dataStore, req.body.password)
        .then(function () {
            return new PasskeyManager(dataStore).getRegistrationOptions()
        })
        .then(function (options) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Passkey registration options generated'
            )
            baseApi.data = options
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/register/verify/', function (req, res, next) {
    const user = InjectionExtractor.extractUserFromInjected(res).user
    const dataStore = user.dataStore
    const passkeyName = `${req.body.name || ''}`
    const passkeyResponse = req.body.response as RegistrationResponseJSON

    checkCurrentPassword(user.namespace, dataStore, req.body.password)
        .then(function () {
            if (!passkeyResponse || typeof passkeyResponse !== 'object') {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'Passkey response is missing'
                )
            }

            return new PasskeyManager(dataStore).verifyRegistration(
                passkeyName,
                passkeyResponse
            )
        })
        .then(function (passkey) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Passkey registered'
            )
            baseApi.data = { passkey }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/delete/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    new PasskeyManager(dataStore)
        .deletePasskey(`${req.body.id || ''}`)
        .then(function () {
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Passkey removed'))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
