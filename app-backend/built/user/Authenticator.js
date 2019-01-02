"use strict";
const jwt = require("jsonwebtoken");
const uuid = require("uuid/v4");
const bcrypt = require("bcryptjs");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const EnvVar = require("../utils/EnvVars");
const CaptainConstants = require("../utils/CaptainConstants");
const Logger = require("../utils/Logger");
const captainDefaultPassword = EnvVar.DEFAULT_PASSWORD || 'captain42';
const COOKIE_AUTH_SUFFIX = 'cookie-';
const WEBHOOK_APP_PUSH_SUFFIX = '-webhook-app-push';
class Authenticator {
    constructor(secret, namespace) {
        this.encryptionKey = secret + namespace; // making encryption key unique per namespace!
        this.namespace = namespace;
        this.tokenVersion = CaptainConstants.isDebug ? 'test' : uuid();
    }
    changepass(oldPass, newPass, savedHashedPassword) {
        const self = this;
        oldPass = oldPass || '';
        newPass = newPass || '';
        return Promise.resolve()
            .then(function () {
            if (!oldPass || !newPass || newPass.length < 8) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Password is too small.');
            }
            return self.isPasswordCorrect(oldPass, savedHashedPassword);
        })
            .then(function (isPasswordCorrect) {
            if (!isPasswordCorrect) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_WRONG_PASSWORD, 'Old password is incorrect.');
            }
            self.tokenVersion = uuid();
            const hashed = bcrypt.hashSync(self.encryptionKey + newPass, bcrypt.genSaltSync(10));
            return hashed;
        });
    }
    isPasswordCorrect(password, savedHashedPassword) {
        const self = this;
        return Promise.resolve().then(function () {
            password = password || '';
            if (!savedHashedPassword) {
                return captainDefaultPassword === password;
            }
            return bcrypt.compareSync(self.encryptionKey + password, savedHashedPassword);
        });
    }
    getAuthTokenForCookies(password, savedHashedPassword) {
        return this.getAuthToken(password, savedHashedPassword, COOKIE_AUTH_SUFFIX);
    }
    getAuthToken(password, savedHashedPassword, keySuffix) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.isPasswordCorrect(password, savedHashedPassword);
        })
            .then(function (isPasswordCorrect) {
            if (!isPasswordCorrect) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_WRONG_PASSWORD, 'Password is incorrect.');
            }
            const userObj = {
                namespace: self.namespace,
                tokenVersion: self.tokenVersion,
            };
            return jwt.sign({
                data: userObj,
            }, self.encryptionKey + (keySuffix ? keySuffix : ''), { expiresIn: '10000h' });
        });
    }
    decodeAuthTokenFromCookies(token) {
        return this.decodeAuthToken(token, COOKIE_AUTH_SUFFIX);
    }
    decodeAuthToken(token, keySuffix) {
        const self = this;
        return new Promise(function (resolve, reject) {
            jwt.verify(token, self.encryptionKey + (keySuffix ? keySuffix : ''), function (err, rawDecoded) {
                if (err) {
                    Logger.e(err);
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID, 'Auth token corrupted'));
                    return;
                }
                const decodedData = rawDecoded.data;
                if (decodedData.tokenVersion !== self.tokenVersion) {
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID, 'Auth token is no longer valid. Request for a new auth token'));
                    return;
                }
                if (decodedData.namespace !== self.namespace) {
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID, 'Auth token does not match the namespace'));
                    return;
                }
                resolve(decodedData);
            });
        });
    }
    getAppPushWebhookToken(appName, tokenVersion) {
        const self = this;
        if (!appName) {
            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'App name are required for webhook token..');
        }
        return self.getGenericToken({
            tokenVersion: tokenVersion,
            appName: appName,
        }, WEBHOOK_APP_PUSH_SUFFIX);
    }
    decodeAppPushWebhookToken(token) {
        const self = this;
        return self.decodeGenericToken(token, WEBHOOK_APP_PUSH_SUFFIX);
    }
    getGenericToken(obj, keySuffix) {
        const self = this;
        obj.namespace = self.namespace;
        return Promise.resolve().then(function () {
            return jwt.sign({
                data: obj,
            }, self.encryptionKey + (keySuffix ? keySuffix : ''));
        });
    }
    decodeGenericToken(token, keySuffix) {
        const self = this;
        return new Promise(function (resolve, reject) {
            jwt.verify(token, self.encryptionKey + (keySuffix ? keySuffix : ''), function (err, rawDecoded) {
                if (err) {
                    Logger.e(err);
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID, 'Token corrupted'));
                    return;
                }
                const decodedData = rawDecoded.data;
                if (decodedData.namespace !== self.namespace) {
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID, 'token does not match the namespace'));
                    return;
                }
                resolve(decodedData);
            });
        });
    }
}
module.exports = Authenticator;
//# sourceMappingURL=Authenticator.js.map