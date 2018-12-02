interface IRegistryInfo {
    id: string
    registryUser: string
    registryPassword: string

    registryDomain: string // TODO check if we need to remove HTTP / HTTPS entered by the user

    registryImagePrefix: string
}

interface IRegistryInfoEncrypted {
    id: string
    registryUser: string
    registryPasswordEncrypted: string

    registryDomain: string

    registryImagePrefix: string
}
