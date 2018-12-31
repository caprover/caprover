"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DataStoreProvider = require("../datastore/DataStoreProvider");
const Authenticator = require("../user/Authenticator");
const CaptainConstants = require("../utils/CaptainConstants");
const CaptainManager = require("../user/system/CaptainManager");
const ServiceManager = require("../user/ServiceManager");
const DockerApi_1 = require("../docker/DockerApi");
const BaseApi = require("../api/BaseApi");
const Logger = require("../utils/Logger");
const InjectionExtractor = require("./InjectionExtractor");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const dockerApi = DockerApi_1.default.get();
const serviceMangerCache = {};
/**
 * Global dependency injection module
 */
function injectGlobal() {
    return function (req, res, next) {
        const locals = res.locals;
        locals.initialized = CaptainManager.get().isInitialized();
        locals.namespace = req.header(CaptainConstants.headerNamespace);
        locals.forceSsl = CaptainManager.get().getForceSslValue();
        if (locals.namespace &&
            locals.namespace !== CaptainConstants.rootNameSpace) {
            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Namespace unknown');
        }
        next();
    };
}
exports.injectGlobal = injectGlobal;
/**
 * User dependency injection module
 */
function injectUser() {
    return function (req, res, next) {
        if (InjectionExtractor.extractUserFromInjected(res).user) {
            next();
            return; // user is already injected by another layer
        }
        const namespace = res.locals.namespace;
        Authenticator.get(namespace)
            .decodeAuthToken(req.header(CaptainConstants.headerAuth) || '')
            .then(function (userDecoded) {
            if (userDecoded) {
                const datastore = DataStoreProvider.getDataStore(namespace);
                if (!serviceMangerCache[namespace]) {
                    serviceMangerCache[namespace] = new ServiceManager(datastore, dockerApi, CaptainManager.get().getLoadBalanceManager());
                }
                const user = {
                    namespace: namespace,
                    dataStore: datastore,
                    serviceManager: serviceMangerCache[namespace],
                    initialized: serviceMangerCache[namespace].isInited(),
                };
                res.locals.user = user;
            }
            next();
        })
            .catch(function (error) {
            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }
            Logger.e(error);
            res.locals.user = undefined;
            next();
        });
    };
}
exports.injectUser = injectUser;
/**
 * A pseudo user injection. Only used for webhooks. Can only trigger certain actions.
 */
function injectUserForWebhook() {
    return function (req, res, next) {
        const token = req.query.token;
        const namespace = req.query.namespace;
        let app = undefined;
        if (!token || !namespace) {
            Logger.e('Trigger build is called with no token/namespace');
            next();
            return;
        }
        const dataStore = DataStoreProvider.getDataStore(namespace);
        let decodedInfo;
        Authenticator.get(namespace)
            .decodeAppPushWebhookToken(token)
            .then(function (data) {
            decodedInfo = data;
            return dataStore
                .getAppsDataStore()
                .getAppDefinition(decodedInfo.appName);
        })
            .then(function (appFound) {
            app = appFound;
            if (app.appPushWebhook &&
                app.appPushWebhook.tokenVersion !== decodedInfo.tokenVersion) {
                throw new Error('Token Info do not match');
            }
            const datastore = DataStoreProvider.getDataStore(namespace);
            if (!serviceMangerCache[namespace]) {
                serviceMangerCache[namespace] = new ServiceManager(datastore, dockerApi, CaptainManager.get().getLoadBalanceManager());
            }
            const user = {
                namespace: namespace,
                dataStore: datastore,
                serviceManager: serviceMangerCache[namespace],
                initialized: serviceMangerCache[namespace].isInited(),
            };
            res.locals.user = user;
            res.locals.app = app;
            res.locals.appName = decodedInfo.appName;
            next();
        })
            .catch(function (error) {
            Logger.e(error);
            res.locals.app = undefined;
            next();
        });
    };
}
exports.injectUserForWebhook = injectUserForWebhook;
/**
 * User dependency injection module. This is a less secure way for user injection. But for reverse proxy services,
 * this is the only way that we can secure the call
 */
function injectUserUsingCookieDataOnly() {
    return function (req, res, next) {
        Authenticator.get(CaptainConstants.rootNameSpace)
            .decodeAuthTokenFromCookies(req.cookies[CaptainConstants.headerCookieAuth])
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
            res.locals.user = undefined;
            next();
        });
    };
}
exports.injectUserUsingCookieDataOnly = injectUserUsingCookieDataOnly;
//# sourceMappingURL=Injector.js.map