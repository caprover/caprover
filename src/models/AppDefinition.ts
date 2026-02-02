import { IHashMapGeneric } from './ICacheGeneric'

export type IAllAppDefinitions = IHashMapGeneric<IAppDef>

export interface IAppEnvVar {
    key: string
    value: string
}

export const enum VolumesTypes {
    BIND = 'bind',
    VOLUME = 'volume',
}

export interface IAppVolume {
    containerPath: string
    volumeName?: string
    hostPath?: string
    mode?: string
}

export interface IAppPort {
    containerPort: number
    hostPort: number
    protocol?: 'udp' | 'tcp'

    publishMode?: 'ingress' | 'host'
}

export interface RepoInfo {
    repo: string
    branch: string
    user: string
    sshKey?: string
    password: string
}

export interface RepoInfoEncrypted {
    repo: string
    branch: string
    user: string
    sshKeyEncrypted?: string
    passwordEncrypted: string
}

export interface IAppVersion {
    version: number
    deployedImageName?: string // empty if the deploy is not completed
    timeStamp: string
    gitHash: string | undefined
}

export interface IAppCustomDomain {
    publicDomain: string
    hasSsl: boolean
}

export interface IAppTag {
    tagName: string
}

export interface IAppDefinitionBase {
    projectId?: string | undefined
    description: string
    deployedVersion: number
    notExposeAsWebApp: boolean
    hasPersistentData: boolean
    hasDefaultSubDomainSsl: boolean
    containerHttpPort?: number
    captainDefinitionRelativeFilePath: string
    forceSsl: boolean
    websocketSupport: boolean
    nodeId?: string
    instanceCount: number
    preDeployFunction?: string
    serviceUpdateOverride?: string
    customNginxConfig?: string
    redirectDomain?: string
    networks: string[]
    customDomain: IAppCustomDomain[]
    tags?: IAppTag[]
    ports: IAppPort[]
    volumes: IAppVolume[]
    envVars: IAppEnvVar[]
    versions: IAppVersion[]
    appDeployTokenConfig?: AppDeployTokenConfig

    // True for apps created before v1.15.0
    // non-existent for apps created on or after v1.15.0
    isLegacyAppName?: boolean
}

export interface IHttpAuth {
    user: string
    password?: string
    passwordHashed?: string
}

export interface AppDeployTokenConfig {
    enabled: boolean
    appDeployToken?: string
}

export interface IAppDef extends IAppDefinitionBase {
    appPushWebhook?: {
        tokenVersion: string
        repoInfo: RepoInfo
        pushWebhookToken: string
    }
    httpAuth?: IHttpAuth
    appName?: string
    isAppBuilding?: boolean
}

export interface IAppDefSaved extends IAppDefinitionBase {
    appPushWebhook:
        | {
              tokenVersion: string
              repoInfo: RepoInfoEncrypted
              pushWebhookToken: string
          }
        | undefined

    httpAuth?: {
        user: string
        passwordHashed: string
    }
}
