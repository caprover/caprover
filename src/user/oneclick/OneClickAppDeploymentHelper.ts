import DataStore from '../../datastore/DataStore'
import { registerAppDefinition } from '../../handlers/users/apps/appdefinition/AppDefinitionHandler'
import { IAppDef } from '../../models/AppDefinition'
import { ICaptainDefinition } from '../../models/ICaptainDefinition'
import { IDockerComposeService } from '../../models/IOneClickAppModels'
import { ProjectDefinition } from '../../models/ProjectDefinition'
import DockerComposeToServiceOverride from '../../utils/DockerComposeToServiceOverride'
import Utils from '../../utils/Utils'
import ServiceManager from '../ServiceManager'

// TODO - Replace with actual API implementation
// Step 1- find the endpoint using the mapping here:
// https://github.com/caprover/caprover-api/blob/master/src/api/ApiManager.ts
// Step 2- Lookup the implementation based on the path found above
// Step 3- Replace the mock implementation below with the implementation found in step 2

class ApiManager {
    constructor(
        private dataStore: DataStore,
        private serviceManager: ServiceManager
    ) {
        // Initialize if needed
    }
    registerNewApp(
        appName: string,
        projectId: string,
        hasPersistentData: boolean,
        isDetachedBuild: boolean
    ): Promise<any> {
        return registerAppDefinition(
            {
                appName,
                projectId,
                hasPersistentData,
                isDetachedBuild,
            },
            this.dataStore,
            this.serviceManager
        )
    }

    registerProject(projectDef: ProjectDefinition): Promise<any> {
        // Mock implementation
        return Promise.resolve({ id: 'mock-project-id' })
    }
    getAllApps(): Promise<any> {
        // Mock implementation
        return Promise.resolve({ appDefinitions: [] })
    }
    updateConfigAndSave(appName: string, appDef: IAppDef): Promise<any> {
        // Mock implementation
        return Promise.resolve({ success: true })
    }
    uploadCaptainDefinitionContent(
        appName: string,
        captainDefinition: ICaptainDefinition,
        tarFileBase64: string,
        skipIfExists: boolean
    ): Promise<any> {
        // Mock implementation
        return Promise.resolve({ success: true })
    }
}

export default class OneClickAppDeploymentHelper {
    private apiManager: ApiManager

    constructor(dataStore: DataStore, serviceManager: ServiceManager) {
        this.apiManager = new ApiManager(dataStore, serviceManager)
    }

    createRegisterPromise(
        appName: string,
        dockerComposeService: IDockerComposeService,
        projectMemoryCache: { projectId: string }
    ) {
        const self = this
        return Promise.resolve().then(function () {
            return self.apiManager.registerNewApp(
                appName,
                projectMemoryCache.projectId,
                !!dockerComposeService.volumes &&
                    !!dockerComposeService.volumes.length,
                false
            )
        })
    }
    createRegisterPromiseProject(
        appName: string,
        projectMemoryCache: { projectId: string }
    ) {
        const self = this
        return Promise.resolve().then(function () {
            const projectDef: ProjectDefinition = {
                id: '',
                name: appName,
                description: ``,
            }
            // change backend to ensure this returns project ID
            return self.apiManager
                .registerProject(projectDef)
                .then(function (data) {
                    projectMemoryCache.projectId = data.id
                })
        })
    }

    createConfigurationPromise(
        appName: string,
        dockerComposeService: IDockerComposeService,
        capAppName: string
    ) {
        const self = this
        return Promise.resolve().then(function () {
            return self.apiManager
                .getAllApps()
                .then(function (data) {
                    const appDefs = data.appDefinitions as IAppDef[]
                    for (let index = 0; index < appDefs.length; index++) {
                        const element = appDefs[index]
                        if (element.appName === appName) {
                            return Utils.copyObject(element)
                        }
                    }
                })
                .then(function (appDef) {
                    if (!appDef) {
                        throw new Error(
                            'App was not found right after registering!!'
                        )
                    }

                    appDef.volumes = appDef.volumes || []
                    appDef.tags = [
                        {
                            tagName: capAppName,
                        },
                    ]

                    const vols = dockerComposeService.volumes || []
                    for (let i = 0; i < vols.length; i++) {
                        const elements = vols[i].split(':')
                        if (elements[0].startsWith('/')) {
                            appDef.volumes.push({
                                hostPath: elements[0],
                                containerPath: elements[1],
                            })
                        } else {
                            appDef.volumes.push({
                                volumeName: elements[0],
                                containerPath: elements[1],
                            })
                        }
                    }

                    appDef.ports = appDef.ports || []
                    const ports = dockerComposeService.ports || []
                    for (let i = 0; i < ports.length; i++) {
                        const elements = ports[i].split(':')
                        appDef.ports.push({
                            hostPort: Number(elements[0]),
                            containerPort: Number(elements[1]),
                        })
                    }

                    appDef.envVars = appDef.envVars || []
                    const environment = dockerComposeService.environment || {}
                    Object.keys(environment).forEach(function (envKey) {
                        appDef.envVars.push({
                            key: envKey,
                            value: environment[envKey],
                        })
                    })

                    const overrideYaml =
                        DockerComposeToServiceOverride.convertUnconsumedComposeParametersToServiceOverride(
                            dockerComposeService
                        )

                    if (overrideYaml) {
                        appDef.serviceUpdateOverride = overrideYaml
                    }

                    if (dockerComposeService.caproverExtra) {
                        if (
                            dockerComposeService.caproverExtra.containerHttpPort
                        ) {
                            appDef.containerHttpPort =
                                dockerComposeService.caproverExtra.containerHttpPort
                        }

                        if (
                            dockerComposeService.caproverExtra.notExposeAsWebApp
                        ) {
                            appDef.notExposeAsWebApp = true
                        }
                        if (
                            dockerComposeService.caproverExtra.websocketSupport
                        ) {
                            appDef.websocketSupport = true
                        }
                    }

                    return self.apiManager.updateConfigAndSave(appName, appDef)
                })
        })
    }

    createDeploymentPromise(
        appName: string,
        dockerComposeService: IDockerComposeService
    ) {
        const self = this
        return Promise.resolve().then(function () {
            const captainDefinition: ICaptainDefinition = {
                schemaVersion: 2,
            }

            if (dockerComposeService.image) {
                captainDefinition.imageName = dockerComposeService.image
            } else {
                captainDefinition.dockerfileLines =
                    dockerComposeService.caproverExtra?.dockerfileLines
            }

            return self.apiManager.uploadCaptainDefinitionContent(
                appName,
                captainDefinition,
                '',
                false
            )
        })
    }
}
