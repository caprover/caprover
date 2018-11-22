interface IServerBlockDetails {
    hasSsl: boolean
    forceSsl: boolean
    publicDomain: string
    localDomain: string
    nginxConfigTemplate: string

    crtPath?: string
    keyPath?: string

    staticWebRoot: string
}
