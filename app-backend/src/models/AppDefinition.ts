type IAllAppDefinitions = IHashMapGeneric<IAppDef>

interface IAppEnvVar {
    key: string
    value: string
}

interface IAppVolume {
    containerPath: string
    volumeName?: string
    hostPath?: string
    type?: 'volume' | 'bind'

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
    password: string
}

interface RepoInfoEncrypted {
    repo: string
    branch: string
    user: string
    passwordEncrypted: string
}

interface IAppVersion {
    version: number
    deployedImageName?: string // empty if the deploy is not completed
    timeStamp: string
    gitHash: string | undefined // TODO make sure we are capturing the right git hash
}

interface IAppCustomDomain {
    publicDomain: string
    hasSsl: boolean
}

abstract class IAppDefinitionBase {
    public deployedVersion: number
    public notExposeAsWebApp: boolean
    public hasPersistentData: boolean
    public hasDefaultSubDomainSsl: boolean

    public forceSsl: boolean
    public nodeId?: string
    public instanceCount: number
    public preDeployFunction?: string
    public customNginxConfig?: string
    public networks: string[]
    public customDomain: IAppCustomDomain[]

    public ports: IAppPort[]
    public volumes: IAppVolume[]
    public envVars: IAppEnvVar[]

    public versions: IAppVersion[]
}

class IAppDef extends IAppDefinitionBase {
    public appPushWebhook?: {
        tokenVersion: string
        repoInfo: RepoInfo
        pushWebhookToken: string
    }
    public appName?: string
    public isAppBuilding?: boolean
}

class IAppDefSaved extends IAppDefinitionBase {
    public appPushWebhook:
        | {
              tokenVersion: string
              repoInfo: RepoInfoEncrypted
              pushWebhookToken: string
          }
        | undefined
}
