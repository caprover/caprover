import configstore = require('configstore')
import ApiStatusCodes from '../api/ApiStatusCodes'
import AppsDataStore from './AppsDataStore'

const PROJECTS_DEFINITIONS = 'projectsDefinitions'

function isNameAllowed(name: string) {
    const isNameFormattingOk =
        !!name &&
        name.length < 50 &&
        /^[a-z]/.test(name) &&
        /[a-z0-9]$/.test(name) &&
        /^[a-z0-9\-]+$/.test(name) &&
        name.indexOf('--') < 0
    return isNameFormattingOk && ['captain', 'root'].indexOf(name) < 0
}

function isValidUUID(uuid: string | undefined): boolean {
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return !!uuid && uuidRegex.test(uuid)
}

class ProjectsDataStore {
    constructor(
        private data: configstore,
        private appsDataStore: AppsDataStore
    ) {}

    saveProject(projectId: string, project: ProjectDefinition) {
        const self = this
        projectId = `${projectId || ''}`.trim()

        return Promise.resolve()

            .then(function () {
                return self.getAllProjects()
            })
            .then(function (allProjects) {
                project.name = `${project.name || ''}`.trim()
                project.id = `${project.id || ''}`.trim()
                project.description = `${project.description || ''}`.trim()
                project.parentProjectId = `${
                    project.parentProjectId || ''
                }`.trim()

                if (!isNameAllowed(project.name)) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'Project name is not allowed'
                    )
                }

                if (project.id !== projectId) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'Project ID does not match'
                    )
                }

                if (!isValidUUID(project.id)) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'Project ID is not a valid UUID'
                    )
                }

                if (project.parentProjectId) {
                    if (project.parentProjectId === project.id) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.ILLEGAL_OPERATION,
                            'Parent Project ID cannot be the same as the project ID'
                        )
                    }

                    if (!isValidUUID(project.parentProjectId)) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.ILLEGAL_OPERATION,
                            'Parent Project ID is not a valid UUID'
                        )
                    }

                    if (
                        !allProjects.some(
                            (p) => p.id === project.parentProjectId
                        )
                    ) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.ILLEGAL_OPERATION,
                            'Parent Project ID does not exist'
                        )
                    }
                }

                const projectToSave: ProjectDefinition = {
                    id: project.id,
                    name: project.name,
                    parentProjectId: project.parentProjectId,
                    description: project.description,
                }

                return self.data.set(
                    `${PROJECTS_DEFINITIONS}.${projectId}`,
                    projectToSave
                )
            })
    }

    getAllProjects(): Promise<ProjectDefinition[]> {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.data.get(PROJECTS_DEFINITIONS)
            })
            .then(function (projects) {
                projects = projects || {}
                return Object.keys(projects).map((key) => projects[key]) || []
            })
    }

    getProject(projectId: string): Promise<ProjectDefinition> {
        const self = this
        projectId = `${projectId || ''}`.trim()
        return Promise.resolve()
            .then(function () {
                return self.data.get(
                    `${PROJECTS_DEFINITIONS}.${projectId}`
                ) as ProjectDefinition | undefined
            })
            .then(function (project) {
                if (!project) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'Project not found'
                    )
                }
                return project
            })
    }

    deleteProject(projectId: string) {
        const self = this

        projectId = `${projectId || ''}`.trim()

        return Promise.resolve()
            .then(function () {
                return self.getProject(projectId)
            })
            .then(function (project) {
                // project exists

                return self.appsDataStore.getAppDefinitions()
            })
            .then(function (appsAll) {
                const apps = Object.keys(appsAll).map((key) => appsAll[key])

                if (apps.some((app) => app.projectId === projectId)) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'Project not empty (has apps)'
                    )
                }
            })
            .then(function () {
                return self.getAllProjects()
            })
            .then(function (allProjects) {
                if (allProjects.some((p) => p.parentProjectId === projectId)) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'Project not empty (has sub projects)'
                    )
                }

                return self.data.delete(`${PROJECTS_DEFINITIONS}.${projectId}`)
            })
    }
}

export default ProjectsDataStore
