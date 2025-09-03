import { v4 as uuid } from 'uuid'
import DataStore from '../../datastore/DataStore'
import { ProjectDefinition } from '../../models/ProjectDefinition'
import Logger from '../../utils/Logger'
import { BaseHandlerResult } from '../BaseHandlerResult'

export interface RegisterProjectParams {
    name: string
    parentProjectId: string
    description: string
}

export interface RegisterProjectResult extends BaseHandlerResult {
    data: ProjectDefinition
}

export async function registerProject(
    params: RegisterProjectParams,
    dataStore: DataStore
): Promise<RegisterProjectResult> {
    const { name, parentProjectId, description } = params

    Logger.d(`Creating project: ${name}`)

    try {
        const projectId = uuid()
        const project = await dataStore
            .getProjectsDataStore()
            .saveProject(projectId, {
                id: projectId,
                name: name,
                parentProjectId: parentProjectId,
                description: description,
            })

        Logger.d(`Project created: ${name}`)

        return {
            message: `Project created: ${name}`,
            data: project,
        }
    } catch (error: any) {
        Logger.e(`Failed to create project: ${error}`)
        throw error
    }
}
