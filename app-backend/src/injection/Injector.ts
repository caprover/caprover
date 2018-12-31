import DataStoreProvider = require('../datastore/DataStoreProvider')
import Authenticator = require('../user/Authenticator')
import CaptainConstants = require('../utils/CaptainConstants')
import CaptainManager = require('../user/system/CaptainManager')
import ServiceManager = require('../user/ServiceManager')
import DockerApiProvider from '../docker/DockerApi'
import BaseApi = require('../api/BaseApi')
import UserModel = require('../models/InjectionInterfaces')
import Logger = require('../utils/Logger')
import { Response, Request, NextFunction } from 'express'
import { CaptainError } from '../models/OtherTypes'
import InjectionExtractor = require('./InjectionExtractor')
import ApiStatusCodes = require('../api/ApiStatusCodes')

const dockerApi = DockerApiProvider.get()

const serviceMangerCache = {} as IHashMapGeneric<ServiceManager>

/**
 * Global dependency injection module
 */
export function injectGlobal() {
    return function(req: Request, res: Response, next: NextFunction) {
        const locals = res.locals

        locals.initialized = CaptainManager.get().isInitialized()
        locals.namespace = req.header(CaptainConstants.headerNamespace)
        locals.forceSsl = CaptainManager.get().getForceSslValue()

        if (
            locals.namespace &&
            locals.namespace !== CaptainConstants.rootNameSpace
        ) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Namespace unknown'
            )
        }

        next()
    }
}

/**
 * User dependency injection module
 */
export function injectUser() {
    return function(req: Request, res: Response, next: NextFunction) {
        if (InjectionExtractor.extractUserFromInjected(res).user) {
            next()
            return // user is already injected by another layer
        }

        const namespace = res.locals.namespace

        Authenticator.get(namespace)
            .decodeAuthToken(req.header(CaptainConstants.headerAuth) || '')
            .then(function(userDecoded) {
                if (userDecoded) {
                    const datastore = DataStoreProvider.getDataStore(namespace)
                    if (!serviceMangerCache[namespace]) {
                        serviceMangerCache[namespace] = new ServiceManager(
                            datastore,
                            dockerApi,
                            CaptainManager.get().getLoadBalanceManager()
                        )
                    }
                    const user: UserModel.UserInjected = {
                        namespace: namespace,
                        dataStore: datastore,
                        serviceManager: serviceMangerCache[namespace],
                        initialized: serviceMangerCache[namespace].isInited(),
                    }
                    res.locals.user = user
                }

                next()
            })
            .catch(function(error: CaptainError) {
                if (error && error.captainErrorType) {
                    res.send(
                        new BaseApi(error.captainErrorType, error.apiMessage)
                    )
                    return
                }
                Logger.e(error)
                res.locals.user = undefined
                next()
            })
    }
}

/**
 * A pseudo user injection. Only used for webhooks. Can only trigger certain actions.
 */
export function injectUserForWebhook() {
    return function(req: Request, res: Response, next: NextFunction) {
        const token = req.query.token
        const namespace = req.query.namespace
        let app = undefined

        if (!token || !namespace) {
            Logger.e('Trigger build is called with no token/namespace')
            next()
            return
        }

        const dataStore = DataStoreProvider.getDataStore(namespace)

        let decodedInfo: UserModel.IAppWebHookToken

        Authenticator.get(namespace)
            .decodeAppPushWebhookToken(token)
            .then(function(data) {
                decodedInfo = data

                return dataStore
                    .getAppsDataStore()
                    .getAppDefinition(decodedInfo.appName)
            })
            .then(function(appFound) {
                app = appFound

                if (
                    app.appPushWebhook &&
                    app.appPushWebhook.tokenVersion !== decodedInfo.tokenVersion
                ) {
                    throw new Error('Token Info do not match')
                }

                const datastore = DataStoreProvider.getDataStore(namespace)

                if (!serviceMangerCache[namespace]) {
                    serviceMangerCache[namespace] = new ServiceManager(
                        datastore,
                        dockerApi,
                        CaptainManager.get().getLoadBalanceManager()
                    )
                }

                const user: UserModel.UserInjected = {
                    namespace: namespace,
                    dataStore: datastore,
                    serviceManager: serviceMangerCache[namespace],
                    initialized: serviceMangerCache[namespace].isInited(),
                }

                res.locals.user = user
                res.locals.app = app
                res.locals.appName = decodedInfo.appName

                next()
            })
            .catch(function(error) {
                Logger.e(error)
                res.locals.app = undefined
                next()
            })
    }
}

/**
 * User dependency injection module. This is a less secure way for user injection. But for reverse proxy services,
 * this is the only way that we can secure the call
 */
export function injectUserUsingCookieDataOnly() {
    return function(req: Request, res: Response, next: NextFunction) {
        Authenticator.get(CaptainConstants.rootNameSpace)
            .decodeAuthTokenFromCookies(
                req.cookies[CaptainConstants.headerCookieAuth]
            )
            .then(function(user) {
                res.locals.user = user

                next()
            })
            .catch(function(error) {
                if (error && error.captainErrorType) {
                    res.send(
                        new BaseApi(error.captainErrorType, error.apiMessage)
                    )
                    return
                }
                Logger.e(error)
                res.locals.user = undefined
                next()
            })
    }
}
