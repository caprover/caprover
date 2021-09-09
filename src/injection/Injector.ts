import { NextFunction, Request, Response } from 'express'
import ApiStatusCodes from '../api/ApiStatusCodes'
import BaseApi from '../api/BaseApi'
import DataStoreProvider from '../datastore/DataStoreProvider'
import DockerApiProvider from '../docker/DockerApi'
import * as UserModel from '../models/InjectionInterfaces'
import { CaptainError } from '../models/OtherTypes'
import Authenticator from '../user/Authenticator'
import ServiceManager from '../user/ServiceManager'
import CaptainManager from '../user/system/CaptainManager'
import CaptainConstants from '../utils/CaptainConstants'
import Logger from '../utils/Logger'
import InjectionExtractor from './InjectionExtractor'

const dockerApi = DockerApiProvider.get()

/**
 * Global dependency injection module
 */
export function injectGlobal() {
    return function (req: Request, res: Response, next: NextFunction) {
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
    return function (req: Request, res: Response, next: NextFunction) {
        if (InjectionExtractor.extractUserFromInjected(res).user) {
            next()
            return // user is already injected by another layer
        }

        const namespace = res.locals.namespace

        Authenticator.getAuthenticator(namespace)
            .decodeAuthToken(req.header(CaptainConstants.headerAuth) || '')
            .then(function (userDecoded) {
                if (userDecoded) {
                    const datastore = DataStoreProvider.getDataStore(namespace)

                    const serviceManager = ServiceManager.get(
                        namespace,
                        Authenticator.getAuthenticator(namespace),
                        datastore,
                        dockerApi,
                        CaptainManager.get().getLoadBalanceManager(),
                        CaptainManager.get().getDomainResolveChecker()
                    )
                    const user: UserModel.UserInjected = {
                        namespace: namespace,
                        dataStore: datastore,
                        serviceManager: serviceManager,
                        initialized: serviceManager.isInited(),
                    }
                    res.locals.user = user
                }

                next()
            })
            .catch(function (error: CaptainError) {
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
 * A pseudo user injection. Only used for build triggers. Can only trigger certain actions.
 */
export function injectUserForBuildTrigger() {
    return function (req: Request, res: Response, next: NextFunction) {
        const locals = res.locals

        const token = req.header(CaptainConstants.headerAppToken) as string
        const namespace = locals.namespace
        const appName = req.params.appName as string

        if (req.header(CaptainConstants.headerAuth)) {
            // Auth header is present, skip user injection for app token
            next()
            return
        }

        if (!token || !namespace || !appName) {
            Logger.e(
                'Trigger app build is called with no token/namespace/appName'
            )
            next()
            return
        }

        const dataStore = DataStoreProvider.getDataStore(namespace)
        let app: IAppDef | undefined = undefined

        Promise.resolve()
            .then(function () {
                return dataStore.getAppsDataStore().getAppDefinition(appName)
            })
            .then(function (appFound) {
                app = appFound

                const tokenMatches =
                    app?.appDeployTokenConfig?.enabled &&
                    app.appDeployTokenConfig.appDeployToken === token

                if (!tokenMatches) {
                    Logger.e('Token mismatch for app build')
                    next()
                    return
                }

                const datastore = DataStoreProvider.getDataStore(namespace)

                const serviceManager = ServiceManager.get(
                    namespace,
                    Authenticator.getAuthenticator(namespace),
                    datastore,
                    dockerApi,
                    CaptainManager.get().getLoadBalanceManager(),
                    CaptainManager.get().getDomainResolveChecker()
                )

                const user: UserModel.UserInjected = {
                    namespace: namespace,
                    dataStore: datastore,
                    serviceManager: serviceManager,
                    initialized: serviceManager.isInited(),
                }

                res.locals.user = user
                res.locals.app = app
                res.locals.appName = appName

                next()
            })
            .catch(function (error) {
                Logger.e(error)
                res.locals.app = undefined
                next()
            })
    }
}

/**
 * A pseudo user injection. Only used for webhooks. Can only trigger certain actions.
 */
export function injectUserForWebhook() {
    return function (req: Request, res: Response, next: NextFunction) {
        const token = req.query.token as string
        const namespace = req.query.namespace as string
        let app = undefined

        if (!token || !namespace) {
            Logger.e('Trigger build is called with no token/namespace')
            next()
            return
        }

        const dataStore = DataStoreProvider.getDataStore(namespace)

        let decodedInfo: UserModel.IAppWebHookToken

        Authenticator.getAuthenticator(namespace)
            .decodeAppPushWebhookToken(token)
            .then(function (data) {
                decodedInfo = data

                return dataStore
                    .getAppsDataStore()
                    .getAppDefinition(decodedInfo.appName)
            })
            .then(function (appFound) {
                app = appFound

                if (
                    app.appPushWebhook &&
                    app.appPushWebhook.tokenVersion !== decodedInfo.tokenVersion
                ) {
                    throw new Error('Token Info do not match')
                }

                const datastore = DataStoreProvider.getDataStore(namespace)

                const serviceManager = ServiceManager.get(
                    namespace,
                    Authenticator.getAuthenticator(namespace),
                    datastore,
                    dockerApi,
                    CaptainManager.get().getLoadBalanceManager(),
                    CaptainManager.get().getDomainResolveChecker()
                )

                const user: UserModel.UserInjected = {
                    namespace: namespace,
                    dataStore: datastore,
                    serviceManager: serviceManager,
                    initialized: serviceManager.isInited(),
                }

                res.locals.user = user
                res.locals.app = app
                res.locals.appName = decodedInfo.appName

                next()
            })
            .catch(function (error) {
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
    return function (req: Request, res: Response, next: NextFunction) {
        Authenticator.getAuthenticator(CaptainConstants.rootNameSpace)
            .decodeAuthTokenFromCookies(
                req.cookies[CaptainConstants.headerCookieAuth]
            )
            .then(function (user) {
                res.locals.user = user

                next()
            })
            .catch(function (error) {
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
