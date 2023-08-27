import express = require('express')
import ApiStatusCodes from '../../../api/ApiStatusCodes'
import BaseApi from '../../../api/BaseApi'
import InjectionExtractor from '../../../injection/InjectionExtractor'
import {
    IProFeatures,
    TwoFactorAuthResponse,
} from '../../../models/IProFeatures'
import ProManagerUtils from '../../../user/pro/ProManagerUtils'
import CaptainConstants from '../../../utils/CaptainConstants'

const OTP_TOKEN_LENGTH = 6

const router = express.Router()

router.post('/apikey/', function (req, res, next) {
    const apiKey = `${req.body.apiKey || ''}`

    const userManager =
        InjectionExtractor.extractUserFromInjected(res).user.userManager

    Promise.resolve()
        .then(function () {
            return userManager.datastore.getRootDomain() as string
        })
        .then(function (rootDomain) {
            return userManager.proManager.validateApiKey(
                apiKey,
                `${CaptainConstants.configs.captainSubDomain}.${rootDomain}`
            )
        })
        .then(function (isValid) {
            if (!isValid) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    'Invalid API Key'
                )
            }
            return userManager.datastore.getProDataStore().setApiKey(apiKey)
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'API Key is set'
            )
            baseApi.data = {}
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/otp/', function (req, res, next) {
    const otpAuthenticator =
        InjectionExtractor.extractUserFromInjected(res).user.otpAuthenticator

    Promise.resolve()
        .then(function () {
            return otpAuthenticator.is2FactorEnabled()
        })
        .then(function (enabled) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                enabled
                    ? 'Two factor auth is enabled'
                    : 'Two factor auth is disabled'
            )
            const twoFactorResponse: TwoFactorAuthResponse = {
                isEnabled: !!enabled,
            }
            baseApi.data = twoFactorResponse
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/otp/', function (req, res, next) {
    const enabled = !!req.body.enabled
    const token = `${req.body.token || ''}`.substring(0, OTP_TOKEN_LENGTH)

    const otpAuthenticator =
        InjectionExtractor.extractUserFromInjected(res).user.otpAuthenticator

    Promise.resolve()
        .then(function () {
            return otpAuthenticator.set2fa(enabled, token)
        })
        .then(function (twoFactorResponse) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                enabled
                    ? 'Two factor auth is enabled'
                    : 'Two factor auth is disabled'
            )
            baseApi.data = twoFactorResponse
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/configs/', function (req, res, next) {
    const userManager =
        InjectionExtractor.extractUserFromInjected(res).user.userManager

    Promise.resolve()
        .then(function () {
            return userManager.proManager.updateConfig(
                ProManagerUtils.ensureProConfigType(req.body.proConfigs)
            )
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Config updated'
            )
            baseApi.data = {}
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/configs/', function (req, res, next) {
    const userManager =
        InjectionExtractor.extractUserFromInjected(res).user.userManager

    Promise.resolve()
        .then(function () {
            return userManager.proManager.getConfig()
        })
        .then(function (proConfigs) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Config retrieved'
            )
            baseApi.data = { proConfigs: proConfigs }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/state/', function (req, res, next) {
    const userManager =
        InjectionExtractor.extractUserFromInjected(res).user.userManager

    Promise.resolve()
        .then(function () {
            return userManager.proManager.getState()
        })
        .then(function (proFeaturesState) {
            const testType: IProFeatures = proFeaturesState
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Config retrieved'
            )
            baseApi.data = { proFeaturesState: testType }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
