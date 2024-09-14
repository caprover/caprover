import express = require('express')
import { v4 as uuid } from 'uuid'
import ApiStatusCodes from '../../api/ApiStatusCodes'
import BaseApi from '../../api/BaseApi'
import InjectionExtractor from '../../injection/InjectionExtractor'
import Logger from '../../utils/Logger'

const router = express.Router()

router.post('/register/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    const projectName = `${req.body.projectName || ''}`.trim()
    const parentProjectId = `${req.body.parentProjectId || ''}`.trim()

    Promise.resolve()
        .then(function () {
            const projectId = uuid()
            return dataStore.getProjectsDataStore().saveProject(projectId, {
                id: projectId,
                name: projectName,
                parentProjectId: parentProjectId,
                description: '',
            })
        })
        .then(function () {
            Logger.d(`Project is saved: ${projectName}`)
            res.send(
                new BaseApi(ApiStatusCodes.STATUS_OK, 'App Definition Saved')
            )
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/delete/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    const projectId = req.body.projectId

    Promise.resolve()
        .then(function () {
            return dataStore //
                .getProjectsDataStore()
                .deleteProject(projectId)
        })
        .then(function () {
            Logger.d(`Project is deleted: ${projectId}`)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Project deleted'))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/update/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    const projectDefinition = req.body.projectDefinition as
        | ProjectDefinition
        | undefined

    Promise.resolve()
        .then(function () {
            if (!projectDefinition) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_OPERATION,
                    'Project Definition is not provided'
                )
            }

            projectDefinition.id = `${projectDefinition.id || ''}`
            projectDefinition.name = `${projectDefinition.name || ''}`
            projectDefinition.parentProjectId = `${
                projectDefinition.parentProjectId || ''
            }`
            projectDefinition.description = `${
                projectDefinition.description || ''
            }`

            if (!projectDefinition.id) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_OPERATION,
                    'Project ID is not provided'
                )
            }

            return dataStore
                .getProjectsDataStore()
                .saveProject(projectDefinition.id, {
                    id: projectDefinition.id,
                    name: projectDefinition.name,
                    parentProjectId: projectDefinition.parentProjectId,
                    description: projectDefinition.description,
                })
        })
        .then(function () {
            Logger.d(`Project is saved: ${projectDefinition?.name}`)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Project Saved'))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

// Get All Projects
router.get('/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    dataStore
        .getProjectsDataStore()
        .getAllProjects()
        .then(function (projects) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Projects are retrieved.'
            )
            baseApi.data = {
                projects: projects,
            }

            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
