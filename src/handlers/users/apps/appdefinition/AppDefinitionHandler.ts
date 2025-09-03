import DataStore from '../../../../datastore/DataStore'
import { ICaptainDefinition } from '../../../../models/ICaptainDefinition'
import ServiceManager from '../../../../user/ServiceManager'
import CaptainConstants from '../../../../utils/CaptainConstants'
import Logger from '../../../../utils/Logger'

export interface RegisterAppDefinitionParams {
    appName: string
    projectId: string
    hasPersistentData: boolean
    isDetachedBuild: boolean
}

export interface BaseHandlerResult {
    message: string
}

export async function registerAppDefinition(
    params: RegisterAppDefinitionParams,
    dataStore: DataStore,
    serviceManager: ServiceManager
): Promise<BaseHandlerResult> {
    const { appName, projectId, hasPersistentData, isDetachedBuild } = params
    let appCreated = false

    Logger.d(`Registering app started: ${appName}`)

    try {
        // Validate project if projectId is provided
        if (projectId) {
            await dataStore.getProjectsDataStore().getProject(projectId)
            // if project is not found, it will throw an error
        }

        // Register the app definition
        await dataStore
            .getAppsDataStore()
            .registerAppDefinition(appName, projectId, hasPersistentData)

        appCreated = true

        // Create captain definition content
        const captainDefinitionContent: ICaptainDefinition = {
            schemaVersion: 2,
            imageName: CaptainConstants.configs.appPlaceholderImageName,
        }

        // Schedule deployment (unless detached build)
        const promiseToIgnore = serviceManager
            .scheduleDeployNewVersion(appName, {
                captainDefinitionContentSource: {
                    captainDefinitionContent: JSON.stringify(
                        captainDefinitionContent
                    ),
                    gitHash: '',
                },
            })
            .catch(function (error) {
                Logger.e(error)
            })

        if (!isDetachedBuild) {
            await promiseToIgnore
        }

        Logger.d(`AppName is saved: ${appName}`)

        return {
            message: 'App Definition Saved',
        }
    } catch (error: any) {
        // Cleanup if app was created but something failed
        if (appCreated) {
            try {
                await dataStore.getAppsDataStore().deleteAppDefinition(appName)
            } catch (cleanupError) {
                Logger.e(
                    `Failed to cleanup app definition after error: ${cleanupError}`
                )
            }
        }

        // Re-throw the error
        throw error
    }
}
