import express = require('express')
import path = require('path')
import favicon = require('serve-favicon')
import loggerMorgan = require('morgan')
import cookieParser = require('cookie-parser')
import bodyParser = require('body-parser')
import httpProxyImport = require('http-proxy')

import CaptainManager from './user/system/CaptainManager'
import BaseApi from './api/BaseApi'
import ApiStatusCodes from './api/ApiStatusCodes'
import * as Injector from './injection/Injector'
import Logger from './utils/Logger'
import CaptainConstants from './utils/CaptainConstants'

import LoginRouter from './routes/login/LoginRouter'
import DownloadRouter from './routes/download/DownloadRouter'
import UserRouter from './routes/user/UserRouter'
import InjectionExtractor from './injection/InjectionExtractor'
import Utils from './utils/Utils'
// import { NextFunction, Request, Response } from 'express'

const httpProxy = httpProxyImport.createProxyServer({})

let app = express()

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
            CaptainConstants.headerNamespace +
                ',' +
                CaptainConstants.headerAuth +
                ',Content-Type'
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
        let isRequestSsl =
            req.secure || req.get('X-Forwarded-Proto') === 'https'

        if (!isRequestSsl) {
            let newUrl = 'https://' + req.get('host') + req.originalUrl
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
        let isRequestSsl =
            req.secure || req.get('X-Forwarded-Proto') === 'https'

        let newUrl =
            (isRequestSsl ? 'https://' : 'http://') +
            req.get('host') +
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

httpProxy.on('error', function (err, req, resOriginal) {
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
            'Something went wrong... err: \n ' +
                'NetData is not running! Are you sure you have started it?'
        )
    } else {
        resOriginal.end(
            'Something went wrong... err: \n ' + (err ? err : 'NULL')
        )
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
        target: 'http://' + CaptainConstants.netDataContainerName + ':19999',
    })
})

//  ************  End of reverse proxy 3rd party services  ****************************************

//  *********************  Beginning of API End Points  *******************************************

let API_PREFIX = '/api/'

app.use(API_PREFIX + ':apiVersionFromRequest/', function (req, res, next) {
    if (req.params.apiVersionFromRequest !== CaptainConstants.apiVersion) {
        res.send(
            new BaseApi(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'This captain instance only accepts API ' +
                    CaptainConstants.apiVersion
            )
        )
        return
    }

    if (!InjectionExtractor.extractGlobalsFromInjected(res).initialized) {
        let response = new BaseApi(
            ApiStatusCodes.STATUS_ERROR_CAPTAIN_NOT_INITIALIZED,
            'Captain is not ready yet...'
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

// Initializing with delay helps with debugging. Usually, docker didn't see the CAPTAIN service
// if this was done without a delay
setTimeout(function () {
    CaptainManager.get().initialize()
}, 1500)

export default app
