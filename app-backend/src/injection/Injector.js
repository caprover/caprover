const DataStoreProvider = require('../datastore/DataStoreProvider');
const Authenticator = require('../user/Authenticator');
const CaptainConstants = require('../utils/CaptainConstants');
const CaptainManager = require('../user/CaptainManager');
const ServiceManager = require('../user/ServiceManager');
const dockerApi = require('../docker/DockerApi').get();
const BaseApi = require('../api/BaseApi');
const Logger = require('../utils/Logger');

const serviceMangerCache = {};

/**
 * Global dependency injection module
 */
module.exports.injectGlobal = function (req, res) {

    return function (req, res, next) {

        const locals = res.locals;

        locals.initialized = CaptainManager.get().isInitialized();
        locals.namespace = req.header(CaptainConstants.header.namespace);
        locals.forceSsl = CaptainManager.get().getForceSslValue();

        next();
    }

};

/**
 * User dependency injection module
 */
module.exports.injectUser = function () {

    return function (req, res, next) {

        const namespace = res.locals.namespace;

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

    }
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
    }
};
