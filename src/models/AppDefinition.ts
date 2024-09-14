type IAllAppDefinitions = IHashMapGeneric<IAppDef>

interface IAppEnvVar {
    key: string
    value: string
}

interface IAppVolume {
    containerPath: string
    volumeName?: string
    hostPath?: string
    mode?: string
}

interface IAppPort {
    containerPort: number
    hostPort: number
    protocol?: 'udp' | 'tcp'

    publishMode?: 'ingress' | 'host'
}

interface RepoInfo {
    repo: string
    branch: string
    user: string
    sshKey?: string
    password: string
}

interface RepoInfoEncrypted {
    repo: string
    branch: string
    user: string
    sshKeyEncrypted?: string
    passwordEncrypted: string
}

interface IAppVersion {
    version: number
    deployedImageName?: string // empty if the deploy is not completed
    timeStamp: string
    gitHash: string | undefined
}

interface IAppCustomDomain {
    publicDomain: string
    hasSsl: boolean
}

interface IAppTag {
    tagName: string
}

interface IAppDefinitionBase {
    projectId?: string
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
}

interface IHttpAuth {
    user: string
    password?: string
    passwordHashed?: string
}

interface AppDeployTokenConfig {
    enabled: boolean
    appDeployToken?: string
}

interface IAppDef extends IAppDefinitionBase {
    appPushWebhook?: {
        tokenVersion: string
        repoInfo: RepoInfo
        pushWebhookToken: string
    }
    httpAuth?: IHttpAuth
    appName?: string
    isAppBuilding?: boolean
}

interface IAppDefSaved extends IAppDefinitionBase {
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
