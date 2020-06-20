import express = require('express')
import BaseApi = require('../../../../api/BaseApi')
import ApiStatusCodes = require('../../../../api/ApiStatusCodes')
import multer = require('multer')
import InjectionExtractor = require('../../../../injection/InjectionExtractor')

const TEMP_UPLOAD = 'temp_upload/'
const router = express.Router()
const upload = multer({
    dest: TEMP_UPLOAD,
})

router.get('/:appName/logs', function (req, res, next) {
    let appName = req.params.appName
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    return Promise.resolve()
        .then(function () {
            const encoding = req.query.encoding as string
            return serviceManager.getAppLogs(
                appName,
                encoding ? encoding : 'ascii'
            )
        })
        .then(function (logs) {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App runtime logs are retrieved'
            )
            baseApi.data = { logs }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/:appName/', function (req, res, next) {
    let appName = req.params.appName
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    return Promise.resolve()
        .then(function () {
            return serviceManager.getBuildStatus(appName)
        })
        .then(function (data) {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App build status retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/:appName/', function (req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore
    let appName = req.params.appName

    dataStore
        .getAppsDataStore()
        .getAppDefinition(appName)
        .then(function (app) {
            // nothing to do with app, just to make sure that it exists!
            next()
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/:appName/', upload.single('sourceFile'), function (
    req,
    res,
    next
) {
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user
        .serviceManager

    const appName = req.params.appName
    const isDetachedBuild = !!req.query.detached
    const captainDefinitionContent =
        (req.body.captainDefinitionContent || '') + ''
    const gitHash = (req.body.gitHash || '') + ''
    let tarballSourceFilePath: string = !!req.file ? req.file.path : ''

    if (!!tarballSourceFilePath === !!captainDefinitionContent) {
        res.send(
            new BaseApi(
                ApiStatusCodes.ILLEGAL_OPERATION,
                'Either tarballfile or captainDefinitionContent should be present.'
            )
        )
        return
    }

    Promise.resolve().then(function () {
        const promiseToDeployNewVer = serviceManager.scheduleDeployNewVersion(
            appName,
            {
                uploadedTarPathSource: !!tarballSourceFilePath
                    ? {
                          uploadedTarPath: tarballSourceFilePath,
                          gitHash,
                      }
                    : undefined,
                captainDefinitionContentSource: !!captainDefinitionContent
                    ? {
                          captainDefinitionContent,
                          gitHash,
                      }
                    : undefined,
            }
        )

        if (isDetachedBuild) {
            res.send(
                new BaseApi(
                    ApiStatusCodes.STATUS_OK_DEPLOY_STARTED,
                    'Deploy is started'
                )
            )
        } else {
            promiseToDeployNewVer
                .then(function () {
                    res.send(
                        new BaseApi(ApiStatusCodes.STATUS_OK, 'Deploy is done')
                    )
                })
                .catch(ApiStatusCodes.createCatcher(res))
        }
    })
})

export = router
