var jwt = require('jsonwebtoken');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var uuid = require('uuid/v4');
var EnvVar = require('../utils/EnvVars');
var bcrypt = require('bcryptjs');
var CaptainManager = require('./CaptainManager');
var CaptainConstants = require('../utils/CaptainConstants');
var Logger = require('../utils/Logger');
var DataStoreProvider = require('../datastore/DataStoreProvider');
var captainDefaultPassword = EnvVar.DEFAULT_PASSWORD || 'captain42';
var COOKIE_AUTH_SUFFIX = 'cookie-';
var WEBHOOK_APP_PUSH_SUFFIX = '-webhook-app-push';
var WEBHOOK_APP_PUSH_DATASTORE_SUFFIX = "-webhook-app-datastore";
var Authenticator = /** @class */ (function () {
    function Authenticator(secret, namespace, dataStore) {
        this.encryptionKey = secret + namespace; //making encryption key unique per namespace!
        this.namespace = namespace;
        this.dataStore = dataStore;
        this.tokenVersion = CaptainConstants.isDebug ? 'test' : uuid();
    }
    Authenticator.prototype.changepass = function (oldPass, newPass) {
        var self = this;
        oldPass = oldPass || '';
        newPass = newPass || '';
        return Promise.resolve()
            .then(function () {
            if (!oldPass || !newPass || newPass.length < 8) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Password is too small.');
            }
            return self.isPasswordCorrect(oldPass);
        })
            .then(function (isPasswordCorrect) {
            if (!isPasswordCorrect) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_WRONG_PASSWORD, 'Old password is incorrect.');
            }
            self.tokenVersion = uuid();
            var hashed = bcrypt.hashSync(self.encryptionKey + newPass, bcrypt.genSaltSync(10));
            return self.dataStore.setHashedPassword(hashed);
        });
    };
    Authenticator.prototype.isPasswordCorrect = function (password) {
        var self = this;
        return self.dataStore
            .getHashedPassword()
            .then(function (savedHashedPassword) {
            password = password || '';
            if (!savedHashedPassword) {
                return captainDefaultPassword === password;
            }
            return bcrypt.compareSync(self.encryptionKey + password, savedHashedPassword);
        });
    };
    Authenticator.prototype.getAuthTokenForCookies = function (password) {
        return this.getAuthToken(password, COOKIE_AUTH_SUFFIX);
    };
    Authenticator.prototype.getAuthToken = function (password, keySuffix) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.isPasswordCorrect(password);
        })
            .then(function (isPasswordCorrect) {
            if (!isPasswordCorrect) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_WRONG_PASSWORD, 'Password is incorrect.');
            }
            var userObj = {
                namespace: self.namespace,
                tokenVersion: self.tokenVersion
            };
            return jwt.sign({
                data: userObj
            }, self.encryptionKey + (keySuffix ? keySuffix : ''), { expiresIn: '10000h' });
        });
    };
    Authenticator.prototype.decodeAuthTokenFromCookies = function (token) {
        return this.decodeAuthToken(token, COOKIE_AUTH_SUFFIX);
    };
    Authenticator.prototype.decodeAuthToken = function (token, keySuffix) {
        var self = this;
        return new Promise(function (resolve, reject) {
            jwt.verify(token, self.encryptionKey + (keySuffix ? keySuffix : ''), function (err, rawDecoded) {
                if (err) {
                    Logger.d(err);
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID, 'Auth token corrupted'));
                    return;
                }
                var decodedData = rawDecoded.data;
                if (decodedData.tokenVersion !== self.tokenVersion) {
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID, 'Auth token is not valid anymore. Request for a new auth token'));
                    return;
                }
                if (decodedData.namespace !== self.namespace) {
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID, 'Auth token does not match the namespace'));
                    return;
                }
                resolve(decodedData);
            });
        });
    };
    Authenticator.prototype.getAppPushWebhookDatastore = function (dataToSave) {
        var self = this;
        return self.getGenericToken(dataToSave, WEBHOOK_APP_PUSH_DATASTORE_SUFFIX);
    };
    Authenticator.prototype.decodeAppPushWebhookDatastore = function (token) {
        var self = this;
        return self.decodeGenericToken(token, WEBHOOK_APP_PUSH_DATASTORE_SUFFIX);
    };
    Authenticator.prototype.getAppPushWebhookToken = function (appName, tokenVersion) {
        var self = this;
        if (!appName) {
            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'App name are required for webhook token..');
        }
        return self.getGenericToken({
            tokenVersion: tokenVersion,
            appName: appName
        }, WEBHOOK_APP_PUSH_SUFFIX);
    };
    Authenticator.prototype.decodeAppPushWebhookToken = function (token) {
        var self = this;
        return self.decodeGenericToken(token, WEBHOOK_APP_PUSH_SUFFIX);
    };
    Authenticator.prototype.getGenericToken = function (obj, keySuffix) {
        var self = this;
        obj.namespace = self.namespace;
        return Promise.resolve()
            .then(function () {
            return jwt.sign({
                data: obj
            }, self.encryptionKey + (keySuffix ? keySuffix : ''));
        });
    };
    Authenticator.prototype.decodeGenericToken = function (token, keySuffix) {
        var self = this;
        return new Promise(function (resolve, reject) {
            jwt.verify(token, self.encryptionKey + (keySuffix ? keySuffix : ''), function (err, rawDecoded) {
                if (err) {
                    Logger.d(err);
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID, 'Token corrupted'));
                    return;
                }
                var decodedData = rawDecoded.data;
                if (decodedData.namespace !== self.namespace) {
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID, 'token does not match the namespace'));
                    return;
                }
                resolve(decodedData);
            });
        });
    };
    return Authenticator;
}());
var authenticatorCache = {};
module.exports = {
    get: function (namespace) {
        if (!namespace) {
            return null;
        }
        if (!authenticatorCache[namespace]) {
            var captainSalt = CaptainManager.get().getCaptainSalt();
            if (captainSalt) {
                authenticatorCache[namespace] = new Authenticator(captainSalt, namespace, DataStoreProvider.getDataStore(namespace));
            }
        }
        return authenticatorCache[namespace];
    }
};
