export class IRegistryTypes {
    static readonly LOCAL_REG = 'LOCAL_REG'
    static readonly REMOTE_REG = 'REMOTE_REG'
}

export type IRegistryType = 'LOCAL_REG' | 'REMOTE_REG'

export interface IRegistryInfo {
    id: string
    registryUser: string
    registryPassword: string

    registryDomain: string // TODO check if we need to remove HTTP / HTTPS entered by the user

    registryImagePrefix: string

    registryType: IRegistryType
}

export interface IRegistryInfoEncrypted {
    id: string
    registryUser: string
    registryPasswordEncrypted: string

    registryDomain: string

    registryImagePrefix: string

    registryType: IRegistryType
}
