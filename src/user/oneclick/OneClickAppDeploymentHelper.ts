import DataStore from '../../datastore/DataStore'
import { uploadCaptainDefinitionContent as uploadCaptainDefinitionContentHandler } from '../../handlers/users/apps/appdata/AppDataHandler'
import {
    getAllAppDefinitions,
    registerAppDefinition,
    updateAppDefinition,
} from '../../handlers/users/apps/appdefinition/AppDefinitionHandler'
import { registerProject } from '../../handlers/users/ProjectHandler'
import { IAppDef } from '../../models/AppDefinition'
import { ICaptainDefinition } from '../../models/ICaptainDefinition'
import { IDockerComposeService } from '../../models/IOneClickAppModels'
import { ProjectDefinition } from '../../models/ProjectDefinition'
import DockerComposeToServiceOverride from '../../utils/DockerComposeToServiceOverride'
import composeAppConfig from '../../utils/ComposeAppConfig'
import Utils from '../../utils/Utils'
import ServiceManager from '../ServiceManager'

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

    registerProject(projectDef: ProjectDefinition) {
        return registerProject(projectDef, this.dataStore)
    }
    getAllApps() {
        return getAllAppDefinitions(this.dataStore, this.serviceManager)
    }
    updateConfigAndSave(appName: string, appDef: IAppDef) {
        return updateAppDefinition({ appName, ...appDef }, this.serviceManager)
    }
    uploadCaptainDefinitionContent(
        appName: string,
        captainDefinition: ICaptainDefinition,
        gitHash: string,
        isDetachedBuild: boolean
    ) {
        const captainDefinitionContent = JSON.stringify(captainDefinition)

        return uploadCaptainDefinitionContentHandler(
            {
                appName,
                isDetachedBuild,
                captainDefinitionContent,
                gitHash,
            },
            this.serviceManager
        )
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
                .then(function (result) {
                    projectMemoryCache.projectId = result.data.id
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
                .then(function (result) {
                    const appDefs = result.data.appDefinitions as IAppDef[]
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

                    const config = composeAppConfig(
                        dockerComposeService,
                        `services.${appName}`
                    )
                    appDef.volumes.push(...config.volumes)
                    appDef.ports = [...(appDef.ports || []), ...config.ports]
                    appDef.envVars = [
                        ...(appDef.envVars || []),
                        ...config.envVars,
                    ]

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
