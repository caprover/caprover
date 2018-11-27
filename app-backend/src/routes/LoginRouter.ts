import express = require('express')
import TokenApi = require('../api/TokenApi')
import BaseApi = require('../api/BaseApi')
import Authenticator = require('../user/Authenticator')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import Logger = require('../utils/Logger')
import CaptainConstants = require('../utils/CaptainConstants')
import InjectionExtractor = require('../injection/InjectionExtractor');

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

    const namespace = InjectionExtractor.extractGlobalsFromInjected(res).namespace;

    Authenticator.get(namespace)
        .getAuthToken(password)
        .then(function(token) {
            authToken = token
            return Authenticator.get(
                namespace
            ).getAuthTokenForCookies(password)
        })
        .then(function(cookieAuth) {
            res.cookie(CaptainConstants.header.cookieAuth, cookieAuth)
            res.send(new TokenApi(authToken))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export = router
