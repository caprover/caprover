interface IRegistryInfo {
    registryUser: string
    registryPassword: string

    registryDomain: string

    registryImagePrefix: string
}

interface IRegistryInfoEncrypted {
    id: string
    registryUser: string
    registryPasswordEncrypted: string

    registryDomain: string

    registryImagePrefix: string
}
