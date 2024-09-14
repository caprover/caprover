import configstore = require('configstore')
import ApiStatusCodes from '../api/ApiStatusCodes'
import AppsDataStore from './AppsDataStore'

const PROJECTS_DEFINITIONS = 'projectsDefinitions'
class ProjectsDataStore {
    constructor(
        private data: configstore,
        private appsDataStore: AppsDataStore
    ) {}

    saveProject(projectId: string, project: ProjectDefinition) {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.set(
                `${PROJECTS_DEFINITIONS}.${projectId}`,
                project
            )
        })
    }

    getProject(projectName: string) {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.get(
                `${PROJECTS_DEFINITIONS}.${projectName}`
            ) as ProjectDefinition | undefined
        })
    }

    deleteProject(projectId: string) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.appsDataStore.getAppDefinitions()
            })
            .then(function (appsAll) {
                const apps = Object.keys(appsAll).map((key) => appsAll[key])

                if (apps.some((app) => app.projectId === projectId)) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'Project not empty'
                    )
                }

                return self.data.delete(`${PROJECTS_DEFINITIONS}.${projectId}`)
            })
    }
}

export default ProjectsDataStore
