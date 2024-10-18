import { IAppDef } from './AppDefinition'

export type CaptainError = {
    captainErrorType: number
    apiMessage: string
}

export abstract class VolumesTypes {
    public static readonly BIND = 'bind'
    public static readonly VOLUME = 'volume'
}

export type AnyError = any

export type PreDeployFunction = (
    appDef: IAppDef | undefined,
    updatedData: any
) => Promise<void>

export interface IDockerApiPort {
    Protocol: string
    TargetPort: number
    PublishedPort: number
    PublishMode?: 'ingress' | 'host'
}

export interface IDockerContainerResource {
    Limits?: { NanoCPUs?: number; MemoryBytes?: number }
    Reservation?: { NanoCPUs?: number; MemoryBytes?: number }
}

export interface ITemplate {
    templateName: string
    dockerHubImageName: string
    tagSuffix: string
    postFromLines?: string
}
