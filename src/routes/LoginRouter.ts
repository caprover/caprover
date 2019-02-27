import express = require('express')
import BaseApi = require('../api/BaseApi')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import CaptainConstants = require('../utils/CaptainConstants')
import InjectionExtractor = require('../injection/InjectionExtractor')
import DataStoreProvider = require('../datastore/DataStoreProvider')
import CaptainManager = require('../user/system/CaptainManager')
import Authenticator = require('../user/Authenticator')

const router = express.Router()

router.post('/', function(req, res, next) {
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

    const namespace = InjectionExtractor.extractGlobalsFromInjected(res)
        .namespace

    let loadedHashedPassword = ''

    Promise.resolve() //
        .then(function() {
            return DataStoreProvider.getDataStore(namespace).getHashedPassword()
        })
        .then(function(savedHashedPassword) {
            loadedHashedPassword = savedHashedPassword
            return Authenticator.getAuthenticator(namespace).getAuthToken(
                password,
                loadedHashedPassword
            )
        })
        .then(function(token) {
            authToken = token
            return Authenticator.getAuthenticator(
                namespace
            ).getAuthTokenForCookies(password, loadedHashedPassword)
        })
        .then(function(cookieAuth) {
            res.cookie(CaptainConstants.headerCookieAuth, cookieAuth)
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Login succeeded'
            )
            baseApi.data = { token: authToken }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export = router
