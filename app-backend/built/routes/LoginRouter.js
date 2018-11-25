"use strict";
const express = require("express");
const TokenApi = require("../api/TokenApi");
const BaseApi = require("../api/BaseApi");
const Authenticator = require("../user/Authenticator");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const CaptainConstants = require("../utils/CaptainConstants");
const router = express.Router();
router.post('/', function (req, res, next) {
    let password = req.body.password || '';
    if (!password) {
        let response = new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, 'password is empty.');
        res.send(response);
        return;
    }
    let authToken;
    Authenticator.get(res.locals.namespace)
        .getAuthToken(password)
        .then(function (token) {
        authToken = token;
        return Authenticator.get(res.locals.namespace).getAuthTokenForCookies(password);
    })
        .then(function (cookieAuth) {
        res.cookie(CaptainConstants.header.cookieAuth, cookieAuth);
        res.send(new TokenApi(authToken));
    })
        .catch(ApiStatusCodes.createCatcher(res));
});
module.exports = router;
//# sourceMappingURL=LoginRouter.js.map