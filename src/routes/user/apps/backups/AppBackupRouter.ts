import express = require('express')
import ApiStatusCodes from '../../../../api/ApiStatusCodes'
import BaseApi from '../../../../api/BaseApi'
import {
    IAppBackupConfig,
    IRcloneRemoteType,
} from '../../../../models/AppBackup'
import CaptainManager from '../../../../user/system/CaptainManager'

const router = express.Router()

function backupManager() {
    return CaptainManager.get().getAppBackupManager()
}

// -------------------------------------------------------------------- remotes

router.get('/remotes/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
            return backupManager().listRemotes()
        })
        .then(function (remotes) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Backup remotes retrieved'
            )
            baseApi.data = { remotes }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/remotes/', function (req, res, next) {
    const name = req.body.name as string
    const type = req.body.type as IRcloneRemoteType
    const params = (req.body.params || {}) as { [k: string]: string }

    return Promise.resolve()
        .then(function () {
            return backupManager().createRemote(name, type, params)
        })
        .then(function (id) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Backup remote created'
            )
            baseApi.data = { id }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/remotes/update/', function (req, res, next) {
    const id = req.body.id as string
    const name = req.body.name as string
    const params = (req.body.params || {}) as { [k: string]: string }

    return Promise.resolve()
        .then(function () {
            return backupManager().updateRemote(id, name, params)
        })
        .then(function () {
            res.send(
                new BaseApi(ApiStatusCodes.STATUS_OK, 'Backup remote updated')
            )
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/remotes/delete/', function (req, res, next) {
    const id = req.body.id as string

    return Promise.resolve()
        .then(function () {
            return backupManager().deleteRemote(id)
        })
        .then(function () {
            res.send(
                new BaseApi(ApiStatusCodes.STATUS_OK, 'Backup remote deleted')
            )
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/remotes/test/', function (req, res, next) {
    const id = req.body.id as string

    return Promise.resolve()
        .then(function () {
            return backupManager().testRemote(id)
        })
        .then(function (result) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                result.ok
                    ? 'Remote reachable'
                    : 'Remote test failed — see output'
            )
            baseApi.data = result
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// ---------------------------------------------------------------- app config

router.get('/:appName/config/', function (req, res, next) {
    const appName = req.params.appName

    return Promise.resolve()
        .then(function () {
            return backupManager().getAppConfig(appName)
        })
        .then(function (config) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Backup config retrieved'
            )
            baseApi.data = { config: config || null }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/:appName/config/', function (req, res, next) {
    const appName = req.params.appName
    const config = req.body.config as IAppBackupConfig

    return Promise.resolve()
        .then(function () {
            if (!config) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'config is required'
                )
            }
            return backupManager().setAppConfig(appName, config)
        })
        .then(function () {
            res.send(
                new BaseApi(ApiStatusCodes.STATUS_OK, 'Backup config saved')
            )
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/:appName/config/delete/', function (req, res, next) {
    const appName = req.params.appName

    return Promise.resolve()
        .then(function () {
            return backupManager().deleteAppConfig(appName)
        })
        .then(function () {
            res.send(
                new BaseApi(ApiStatusCodes.STATUS_OK, 'Backup config removed')
            )
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// -------------------------------------------------------------- backup/restore

router.post('/:appName/backup/', function (req, res, next) {
    const appName = req.params.appName

    return Promise.resolve()
        .then(function () {
            return backupManager().runBackup(appName)
        })
        .then(function (jobId) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Backup started'
            )
            baseApi.data = { jobId }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/:appName/restore/', function (req, res, next) {
    const appName = req.params.appName

    return Promise.resolve()
        .then(function () {
            return backupManager().runRestore(appName)
        })
        .then(function (jobId) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Restore started'
            )
            baseApi.data = { jobId }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// ---------------------------------------------------------------------- jobs

router.get('/:appName/jobs/', function (req, res, next) {
    const appName = req.params.appName

    return Promise.resolve()
        .then(function () {
            return backupManager().listJobs(appName)
        })
        .then(function (jobs) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Backup jobs retrieved'
            )
            baseApi.data = { jobs }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/:appName/jobs/:jobId/log/', function (req, res, next) {
    const { appName, jobId } = req.params

    return Promise.resolve()
        .then(function () {
            return backupManager().getJobLog(appName, jobId)
        })
        .then(function (log) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Backup job log retrieved'
            )
            baseApi.data = { log }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
