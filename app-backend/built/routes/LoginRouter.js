var express = require('express');
var router = express.Router();
var TokenApi = require('../api/TokenApi');
var BaseApi = require('../api/BaseApi');
var Authenticator = require('../user/Authenticator');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var Logger = require('../utils/Logger');
var CaptainConstants = require('../utils/CaptainConstants');
router.post('/', function (req, res, next) {
    var password = req.body.password || '';
    if (!password) {
        var response = new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, 'password is empty.');
        res.send(response);
        return;
    }
    var authToken = null;
    Authenticator.get(res.locals.namespace).getAuthToken(password)
        .then(function (token) {
        authToken = token;
        return Authenticator.get(res.locals.namespace).getAuthTokenForCookies(password);
    })
        .then(function (cookieAuth) {
        res.cookie(CaptainConstants.header.cookieAuth, cookieAuth);
        res.send(new TokenApi(authToken));
    })
        .catch(function (error) {
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
        }
        else {
            Logger.e(error);
            res.sendStatus(500);
        }
    });
});
module.exports = router;
