import DataStore from '../../../../datastore/DataStore'
import { ICaptainDefinition } from '../../../../models/ICaptainDefinition'
import ServiceManager from '../../../../user/ServiceManager'
import CaptainConstants from '../../../../utils/CaptainConstants'
import Logger from '../../../../utils/Logger'

import { BaseHandlerResult } from '../../../BaseHandlerResult'

export interface RegisterAppDefinitionParams {
    appName: string
    projectId: string
    hasPersistentData: boolean
    isDetachedBuild: boolean
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

export interface GetAllAppDefinitionsResult extends BaseHandlerResult {
    data: {
        appDefinitions: any[]
        rootDomain: string
        captainSubDomain: string
        defaultNginxConfig: any
    }
}

export async function getAllAppDefinitions(
    dataStore: DataStore,
    serviceManager: ServiceManager
): Promise<GetAllAppDefinitionsResult> {
    Logger.d('Getting all app definitions started')

    try {
        const apps = await dataStore.getAppsDataStore().getAppDefinitions()
        const appsArray: any[] = []

        Object.keys(apps).forEach(function (key) {
            const app = apps[key]
            app.appName = key
            app.isAppBuilding = serviceManager.isAppBuilding(key)
            app.appPushWebhook = app.appPushWebhook || undefined
            appsArray.push(app)
        })

        const defaultNginxConfig = await dataStore.getDefaultAppNginxConfig()

        Logger.d(`App definitions retrieved: ${appsArray.length} apps`)

        return {
            message: 'App definitions are retrieved.',
            data: {
                appDefinitions: appsArray,
                rootDomain: dataStore.getRootDomain(),
                captainSubDomain: CaptainConstants.configs.captainSubDomain,
                defaultNginxConfig: defaultNginxConfig,
            },
        }
    } catch (error: any) {
        Logger.e(`Failed to get app definitions: ${error}`)
        throw error
    }
}
