import express = require('express')
import ApiStatusCodes from '../../../../api/ApiStatusCodes'
import BaseApi from '../../../../api/BaseApi'
import { uploadCaptainDefinitionContent as uploadCaptainDefinitionContentHandler } from '../../../../handlers/users/apps/appdata/AppDataHandler'
import InjectionExtractor from '../../../../injection/InjectionExtractor'
import multer = require('multer')

const TEMP_UPLOAD = 'temp_upload/'
const router = express.Router()
const upload = multer({
    dest: TEMP_UPLOAD,
})

router.get('/:appName/logs', function (req, res, next) {
    const appName = req.params.appName
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    return Promise.resolve()
        .then(function () {
            const encoding = req.query.encoding as string
            return serviceManager.getAppLogs(
                appName,
                encoding ? encoding : 'ascii'
            )
        })
        .then(function (logs) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App runtime logs are retrieved'
            )
            baseApi.data = { logs }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/:appName/', function (req, res, next) {
    const appName = req.params.appName
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    return Promise.resolve()
        .then(function () {
            return serviceManager.getBuildStatus(appName)
        })
        .then(function (data) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App build status retrieved'
            )
            baseApi.data = data
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/:appName/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore
    const appName = req.params.appName

    return dataStore
        .getAppsDataStore()
        .getAppDefinition(appName)
        .then(function (app) {
            // nothing to do with app, just to make sure that it exists!
            next()
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// uploadCaptainDefinitionContent
router.post(
    '/:appName/',
    upload.single('sourceFile'),
    function (req, res, next) {
        const serviceManager =
            InjectionExtractor.extractUserFromInjected(res).user.serviceManager

        const appName = req.params.appName
        const isDetachedBuild = !!req.query.detached
        const captainDefinitionContent = `${req.body.captainDefinitionContent || ''}`
        const gitHash = `${req.body.gitHash || ''}`
        const tarballSourceFilePath: string = req.file ? req.file.path : ''

        return uploadCaptainDefinitionContentHandler(
            {
                appName,
                isDetachedBuild,
                captainDefinitionContent: captainDefinitionContent || undefined,
                gitHash: gitHash || undefined,
                uploadedTarPathSource: tarballSourceFilePath || undefined,
            },
            serviceManager
        )
            .then(function (result) {
                const status = isDetachedBuild
                    ? ApiStatusCodes.STATUS_OK_DEPLOY_STARTED
                    : ApiStatusCodes.STATUS_OK
                res.send(new BaseApi(status, result.message))
            })
            .catch(ApiStatusCodes.createCatcher(res))
    }
)

export default router
