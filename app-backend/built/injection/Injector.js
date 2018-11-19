var DataStoreProvider = require('../datastore/DataStoreProvider');
var Authenticator = require('../user/Authenticator');
var CaptainConstants = require('../utils/CaptainConstants');
var CaptainManager = require('../user/CaptainManager');
var ServiceManager = require('../user/ServiceManager');
var dockerApi = require('../docker/DockerApi').get();
var BaseApi = require('../api/BaseApi');
var Logger = require('../utils/Logger');
var serviceMangerCache = {};
/**
 * Global dependency injection module
 */
module.exports.injectGlobal = function (req, res) {
    return function (req, res, next) {
        var locals = res.locals;
        locals.initialized = CaptainManager.get().isInitialized();
        locals.namespace = req.header(CaptainConstants.header.namespace);
        locals.forceSsl = CaptainManager.get().getForceSslValue();
        next();
    };
};
/**
 * User dependency injection module
 */
module.exports.injectUser = function () {
    return function (req, res, next) {
        if (res.locals.user) {
            next();
            return; // user is already injected by another layer
        }
        var namespace = res.locals.namespace;
        Authenticator.get(namespace)
            .decodeAuthToken(req.header(CaptainConstants.header.auth))
            .then(function (user) {
            if (user) {
                user.dataStore = DataStoreProvider.getDataStore(namespace);
                if (!serviceMangerCache[user.namespace]) {
                    serviceMangerCache[user.namespace] = new ServiceManager(user, dockerApi, CaptainManager.get().getLoadBalanceManager());
                }
                user.serviceManager = serviceMangerCache[user.namespace];
                user.initialized = user.serviceManager.isInited();
            }
            res.locals.user = user;
            next();
        })
            .catch(function (error) {
            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }
            Logger.e(error);
            res.locals.user = null;
            next();
        });
    };
};
/**
 * A pseudo user injection. Only used for webhooks. Can only trigger certain actions.
 */
module.exports.injectUserForWebhook = function () {
    return function (req, res, next) {
        var token = req.query.token;
        var namespace = req.query.namespace;
        var app = null;
        if (!token || !namespace) {
            Logger.e('Trigger build is called with no token/namespace');
            next();
            return;
        }
        var dataStore = DataStoreProvider.getDataStore(namespace);
        var decodedInfo = null;
        Authenticator.get(namespace).decodeAppPushWebhookToken(token)
            .then(function (data) {
            decodedInfo = data;
            return dataStore.getAppsDataStore()
                .getAppDefinition(data.appName);
        })
            .then(function (appFound) {
            app = appFound;
            if (app.appPushWebhook.tokenVersion !== decodedInfo.tokenVersion) {
                throw new Error('Token Info do not match');
            }
            var user = {
                namespace: namespace
            };
            user.dataStore = DataStoreProvider.getDataStore(namespace);
            if (!serviceMangerCache[user.namespace]) {
                serviceMangerCache[user.namespace] = new ServiceManager(user, dockerApi, CaptainManager.get().getLoadBalanceManager());
            }
            user.serviceManager = serviceMangerCache[user.namespace];
            user.initialized = user.serviceManager.isInited();
            res.locals.user = user;
            res.locals.app = app;
            res.locals.appName = decodedInfo.appName;
            next();
        })
            .catch(function (error) {
            Logger.e(error);
            res.locals.app = null;
            next();
        });
    };
};
/**
 * User dependency injection module. This is a less secure way for user injection. But for reverse proxy services,
 * this is the only way that we can secure the call
 */
module.exports.injectUserUsingCookieDataOnly = function () {
    return function (req, res, next) {
        Authenticator.get(CaptainConstants.rootNameSpace)
            .decodeAuthTokenFromCookies(req.cookies[CaptainConstants.header.cookieAuth])
            .then(function (user) {
            res.locals.user = user;
            next();
        })
            .catch(function (error) {
            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }
            Logger.e(error);
            res.locals.user = null;
            next();
        });
    };
};
