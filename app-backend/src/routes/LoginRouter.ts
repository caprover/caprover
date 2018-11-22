import express = require("express");
import TokenApi = require("../api/TokenApi");
import BaseApi = require("../api/BaseApi");
import Authenticator = require("../user/Authenticator");
import ApiStatusCodes = require("../api/ApiStatusCodes");
import Logger = require("../utils/Logger");
import CaptainConstants = require("../utils/CaptainConstants");

const router = express.Router();

router.post("/", function(req, res, next) {

    let password = req.body.password || "";

    if (!password) {
        let response = new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC,
            "password is empty.");
        res.send(response);
        return;
    }

    let authToken: string;

    Authenticator.get(res.locals.namespace).getAuthToken(password)
        .then(function(token) {
            authToken = token;
            return Authenticator.get(res.locals.namespace).getAuthTokenForCookies(password);
        })
        .then(function(cookieAuth) {
            res.cookie(CaptainConstants.header.cookieAuth, cookieAuth);
            res.send(new TokenApi(authToken));
        })
        .catch(function(error) {
            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            } else {
                Logger.e(error);
                res.sendStatus(500);
            }
        });

});

export = router;