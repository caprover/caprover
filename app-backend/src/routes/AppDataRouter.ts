import express = require('express')
import BaseApi = require('../api/BaseApi')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import Logger = require('../utils/Logger')
import multer = require('multer')
import fs = require('fs-extra')
import DataStore = require('../datastore/DataStoreImpl')
import ServiceManager = require('../user/ServiceManager')
import InjectionExtractor = require('../injection/InjectionExtractor');

const TEMP_UPLOAD = 'temp_upload/'
const router = express.Router()
const upload = multer({
    dest: TEMP_UPLOAD,
})

router.get('/:appName/', function(req, res, next) {
    let appName = req.params.appName
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    return Promise.resolve()
        .then(function() {
            return serviceManager.getBuildStatus(appName)
        })
        .then(function(data) {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App build status retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/:appName/', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user.dataStore
    let appName = req.params.appName

    dataStore
        .getAppsDataStore()
        .getAppDefinition(appName)
        .then(function(app) {
            // nothing to do with app, just to make sure that it exists!
            next()
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/:appName/', upload.single('sourceFile'), function(
    req,
    res,
    next
) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user.dataStore
    const serviceManager = InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    const appName = req.params.appName
    const isDetachedBuild = !!req.query.detached
    const captainDefinitionContent = req.body.captainDefinitionContent
    const gitHash = req.body.gitHash || ''
    let tarballSourceFilePath: string = !!req.file ? req.file.path : ''

    if (
        (!!tarballSourceFilePath && !!captainDefinitionContent) ||
        (!tarballSourceFilePath && !captainDefinitionContent)
    ) {
        res.send(
            new BaseApi(
                ApiStatusCodes.ILLEGAL_OPERATION,
                'Either tarballfile or captainDefinitionContent should be present.'
            )
        )
        return
    }

    Promise.resolve()
        .then(function() {
            if (captainDefinitionContent) {
                for (let i = 0; i < 1000; i++) {
                    let tempPath =
                        __dirname + '/../../' + TEMP_UPLOAD + appName + i
                    if (!fs.pathExistsSync(tempPath)) {
                        tarballSourceFilePath = tempPath
                        break
                    }
                }

                if (!tarballSourceFilePath) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        'Cannot create a temp file! Something is seriously wrong with the temp folder'
                    )
                }

                return serviceManager.createTarFarFromCaptainContent(
                    captainDefinitionContent,
                    appName,
                    tarballSourceFilePath
                )
            }
        })
        .then(function() {
            if (isDetachedBuild) {
                res.send(
                    new BaseApi(
                        ApiStatusCodes.STATUS_OK_DEPLOY_STARTED,
                        'Deploy is started'
                    )
                )
                startBuildProcess().catch(function(error) {
                    Logger.e(error)
                })
            } else {
                return startBuildProcess().then(function() {
                    res.send(
                        new BaseApi(ApiStatusCodes.STATUS_OK, 'Deploy is done')
                    )
                })
            }
        })
        .catch(function(error) {
            Logger.e(error)

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage))
                return
            }

            if (!error) {
                error = new Error('ERROR: NULL')
            }

            res.send(
                new BaseApi(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    error.stack + ''
                )
            )

            try {
                if (tarballSourceFilePath) {
                    fs.removeSync(tarballSourceFilePath)
                }
            } catch (ignore) {}
        })

    function startBuildProcess() {
        return serviceManager
            .createImage(
                appName,
                {
                    pathToSrcTarballFile: tarballSourceFilePath,
                },
                gitHash
            )
            .then(function(version) {
                if (tarballSourceFilePath) {
                    fs.removeSync(tarballSourceFilePath)
                }
                return version
            })
            .catch(function(error) {
                return new Promise<void>(function(resolve, reject) {
                    if (tarballSourceFilePath) {
                        fs.removeSync(tarballSourceFilePath)
                    }
                    reject(error)
                })
            })
            .then(function(version: number) {
                return serviceManager.ensureServiceInitedAndUpdated(
                    appName,
                    version
                )
            })
            .catch(function(error) {
                return new Promise<void>(function(resolve, reject) {
                    serviceManager.logBuildFailed(appName, error)
                    reject(error)
                })
            })
    }
})

export = router
