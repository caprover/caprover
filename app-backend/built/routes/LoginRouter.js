"use strict";
const express = require("express");
const BaseApi = require("../api/BaseApi");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const CaptainConstants = require("../utils/CaptainConstants");
const InjectionExtractor = require("../injection/InjectionExtractor");
const DataStoreProvider = require("../datastore/DataStoreProvider");
const CaptainManager = require("../user/system/CaptainManager");
const router = express.Router();
router.post('/', function (req, res, next) {
    let password = req.body.password || '';
    if (!password) {
        let response = new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, 'password is empty.');
        res.send(response);
        return;
    }
    let authToken;
    const namespace = InjectionExtractor.extractGlobalsFromInjected(res)
        .namespace;
    let loadedHashedPassword = '';
    Promise.resolve() //
        .then(function () {
        return DataStoreProvider.getDataStore(namespace).getHashedPassword();
    })
        .then(function (savedHashedPassword) {
        loadedHashedPassword = savedHashedPassword;
        return CaptainManager.getAuthenticator(namespace).getAuthToken(password, loadedHashedPassword);
    })
        .then(function (token) {
        authToken = token;
        return CaptainManager.getAuthenticator(namespace).getAuthTokenForCookies(password, loadedHashedPassword);
    })
        .then(function (cookieAuth) {
        res.cookie(CaptainConstants.headerCookieAuth, cookieAuth);
        let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Login succeeded');
        baseApi.data = { token: authToken };
        res.send(baseApi);
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
module.exports = router;
//# sourceMappingURL=LoginRouter.js.map