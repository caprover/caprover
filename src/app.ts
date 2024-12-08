import express = require('express')
import path = require('path')
import favicon = require('serve-favicon')
import loggerMorgan = require('morgan')
import cookieParser = require('cookie-parser')
import bodyParser = require('body-parser')
import httpProxyImport = require('http-proxy')

import * as http from 'http'
import ApiStatusCodes from './api/ApiStatusCodes'
import BaseApi from './api/BaseApi'
import DockerApi from './docker/DockerApi'
import InjectionExtractor from './injection/InjectionExtractor'
import * as Injector from './injection/Injector'
import DownloadRouter from './routes/download/DownloadRouter'
import LoginRouter from './routes/login/LoginRouter'
import ThemePublicRouter from './routes/public/ThemePublicRouter'
import UserRouter from './routes/user/UserRouter'
import CaptainManager from './user/system/CaptainManager'
import CaptainConstants from './utils/CaptainConstants'
import EnvVars from './utils/EnvVars'
import Logger from './utils/Logger'
import Utils from './utils/Utils'

// import { NextFunction, Request, Response } from 'express'

const httpProxy = httpProxyImport.createProxyServer({})

const app = express()

app.set('views', path.join(__dirname, '../views'))
app.set('view engine', 'ejs')

app.use(favicon(path.join(__dirname, '../public', 'favicon.ico')))
app.use(
    loggerMorgan('dev', {
        skip: function (req, res) {
            return (
                req.originalUrl === CaptainConstants.healthCheckEndPoint ||
                req.originalUrl.startsWith(
                    CaptainConstants.netDataRelativePath + '/'
                )
            )
        },
    })
)
app.use(bodyParser.json())
app.use(
    bodyParser.urlencoded({
        extended: false,
    })
)
app.use(cookieParser())

if (CaptainConstants.isDebug) {
    app.use('*', function (req, res, next) {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Credentials', 'true')
        res.setHeader(
            'Access-Control-Allow-Headers',
            `${CaptainConstants.headerNamespace},${CaptainConstants.headerAuth},Content-Type`
        )

        if (req.method === 'OPTIONS') {
            res.sendStatus(200)
        } else {
            next()
        }
    })

    app.use('/force-exit', function (req, res, next) {
        res.send('Okay... I will exit in a second...')

        setTimeout(function () {
            process.exit(0)
        }, 500)
    })
}

app.use(Injector.injectGlobal())

app.use(function (req, res, next) {
    if (InjectionExtractor.extractGlobalsFromInjected(res).forceSsl) {
        const isRequestSsl =
            req.secure || req.get('X-Forwarded-Proto') === 'https'

        if (!isRequestSsl) {
            const newUrl = `https://${req.hostname}:${EnvVars.CAPTAIN_HOST_HTTPS_PORT}${req.originalUrl}`
            res.redirect(302, newUrl)
            return
        }
    }

    next()
})

app.use(express.static(path.join(__dirname, '../dist-frontend')))

app.use(express.static(path.join(__dirname, 'public')))

app.use(CaptainConstants.healthCheckEndPoint, function (req, res, next) {
    res.send(CaptainManager.get().getHealthCheckUuid())
})

//  ************  Beginning of reverse proxy 3rd party services  ****************************************

app.use(CaptainConstants.netDataRelativePath, function (req, res, next) {
    if (
        req.originalUrl.indexOf(CaptainConstants.netDataRelativePath + '/') !==
        0
    ) {
        const isRequestSsl =
            req.secure || req.get('X-Forwarded-Proto') === 'https'

        const newUrl =
            (isRequestSsl ? 'https://' : 'http://') +
            req.hostname + ':' +
            (isRequestSsl ? CaptainConstants.configs.nginxPortNumber443 : CaptainConstants.configs.nginxPortNumber80) +
            CaptainConstants.netDataRelativePath +
            '/'
        res.redirect(302, newUrl)
        return
    }

    next()
})

app.use(
    CaptainConstants.netDataRelativePath,
    Injector.injectUserUsingCookieDataOnly()
)

app.use(CaptainConstants.netDataRelativePath, function (req, res, next) {
    if (!InjectionExtractor.extractUserFromInjected(res)) {
        Logger.e('User not logged in for NetData')
        res.sendStatus(500)
    } else {
        next()
    }
})

httpProxy.on('error', function (err, req, resOriginal: http.ServerResponse) {
    if (err) {
        Logger.e(err)
    }

    resOriginal.writeHead(500, {
        'Content-Type': 'text/plain',
    })

    if (
        (err + '').indexOf('getaddrinfo ENOTFOUND captain-netdata-container') >=
        0
    ) {
        resOriginal.end(
            `Something went wrong... err:  \n NetData is not running! Are you sure you have started it?`
        )
    } else {
        resOriginal.end(`Something went wrong... err: \n ${err ? err : 'NULL'}`)
    }
})

app.use(CaptainConstants.netDataRelativePath, function (req, res, next) {
    if (Utils.isNotGetRequest(req)) {
        res.writeHead(401, {
            'Content-Type': 'text/plain',
        })
        res.send('Demo mode is for viewing only')
        return
    }

    httpProxy.web(req, res, {
        target: `http://${CaptainConstants.netDataContainerName}:19999`,
    })
})

//  ************  End of reverse proxy 3rd party services  ****************************************

//  *********************  Beginning of API End Points  *******************************************

const API_PREFIX = '/api/'

app.use(API_PREFIX + ':apiVersionFromRequest/', function (req, res, next) {
    if (req.params.apiVersionFromRequest !== CaptainConstants.apiVersion) {
        res.send(
            new BaseApi(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                `This captain instance only accepts API ${CaptainConstants.apiVersion}`
            )
        )
        return
    }

    if (!InjectionExtractor.extractGlobalsFromInjected(res).initialized) {
        const response = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_CAPTAIN_NOT_INITIALIZED,
            'Captain is not ready yet...'
        )
        res.send(response)
        return
    }

    if (DockerApi.get().dockerNeedsUpdate) {
        const response = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_GENERIC,
            'Docker version is too old. Please update Docker to use CapRover.'
        )
        res.send(response)
        return
    }

    next()
})

// unsecured end points:
app.use(API_PREFIX + CaptainConstants.apiVersion + '/login/', LoginRouter)
app.use(
    API_PREFIX + CaptainConstants.apiVersion + '/downloads/',
    DownloadRouter
)
app.use(API_PREFIX + CaptainConstants.apiVersion + '/theme/', ThemePublicRouter)

// secured end points
app.use(API_PREFIX + CaptainConstants.apiVersion + '/user/', UserRouter)

//  *********************  End of API End Points  *******************************************

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    res.locals.err = new Error('Not Found')
    res.locals.err.errorStatus = 404
    next(res.locals.err)
})

// error handler
app.use(function (err, req, res, next) {
    Promise.reject(err).catch(ApiStatusCodes.createCatcher(res))
} as express.ErrorRequestHandler)

export default app

export function initializeCaptainWithDelay() {
    // Initializing with delay helps with debugging. Usually, docker didn't see the CAPTAIN service
    // if this was done without a delay
    setTimeout(function () {
        CaptainManager.get().initialize()
    }, 1500)
}
