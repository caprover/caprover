interface IServerBlockDetails {
    hasSsl: boolean
    forceSsl: boolean
    publicDomain: string
    localDomain: string
    nginxConfigTemplate: string
    containerHttpPort: number

    crtPath?: string
    keyPath?: string
    customErrorPagesDirectory: string
    staticWebRoot: string
}
