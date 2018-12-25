import { CaptainEncryptor } from '../utils/Encryptor'
import configstore = require('configstore')
import uuid = require('uuid/v4')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import { IRegistryInfo, IRegistryInfoEncrypted, IRegistryTypes, IRegistryType } from '../models/IRegistryInfo'

const DOCKER_REGISTRIES = 'dockerRegistries'
const DEFAULT_DOCKER_REGISTRY_ID = 'defaultDockerRegId'

class RegistriesDataStore {
    private encryptor: CaptainEncryptor

    constructor(private data: configstore, private namepace: string) {}

    setEncryptor(encryptor: CaptainEncryptor) {
        this.encryptor = encryptor
    }

    getDefaultPushRegistryId(): Promise<string | undefined> {
        const self = this

        return Promise.resolve().then(function() {
            return self.data.get(DEFAULT_DOCKER_REGISTRY_ID)
        })
    }

    setDefaultPushRegistryId(registryId: string) {
        const self = this

        return Promise.resolve()
            .then(function() {
                return self.getAllRegistries()
            })
            .then(function(registries) {
                let found = false

                for (let i = 0; i < registries.length; i++) {
                    const registry = registries[i]
                    if (registry.id === registryId) {
                        found = true
                    }
                }

                // registryId can be NULL/Empty, meaning that no registry will be the default push registry
                if (!found && !!registryId) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.NOT_FOUND,
                        'Registry not found'
                    )
                }

                self.data.set(DEFAULT_DOCKER_REGISTRY_ID, registryId)
            })
    }

    getRegistryById(registryId: string) {
        const self = this

        return Promise.resolve()
            .then(function() {
                if (!registryId) throw new Error('Empty registry id!')

                return self.getAllRegistries()
            })
            .then(function(registries) {
                for (let i = 0; i < registries.length; i++) {
                    const registry = registries[i]
                    if (registry.id === registryId) {
                        return registry
                    }
                }

                throw ApiStatusCodes.createError(
                    ApiStatusCodes.NOT_FOUND,
                    'Registry not found'
                )
            })
    }

    deleteRegistry(registryId: string) {
        const self = this

        return Promise.resolve()
            .then(function() {
                if (!registryId) throw new Error('Empty registry id to delete!')

                return self.getAllRegistries()
            })
            .then(function(registries) {
                const newReg = []
                for (let i = 0; i < registries.length; i++) {
                    const registry = registries[i]
                    if (registry.id !== registryId) {
                        newReg.push(registry)
                    }
                }

                if (newReg.length === registries.length) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.NOT_FOUND,
                        'Registry not found'
                    )
                }

                self.saveAllRegistries(newReg)
            })
    }

    getAllRegistries() {
        const self = this

        return Promise.resolve()
            .then(function() {
                return self.data.get(DOCKER_REGISTRIES) || []
            })
            .then(function(registries: IRegistryInfoEncrypted[]) {
                const unencryptedList: IRegistryInfo[] = []
                for (let i = 0; i < registries.length; i++) {
                    const element = registries[i]
                    unencryptedList.push({
                        id: element.id,
                        registryDomain: element.registryDomain,
                        registryImagePrefix: element.registryImagePrefix,
                        registryUser: element.registryUser,
                        registryPassword: self.encryptor.decrypt(
                            element.registryPasswordEncrypted
                        ),
                        registryType: element.registryType,
                    })
                }
                return unencryptedList
            })
    }

    updateRegistry(
        id: string,
        registryUser: string,
        registryPassword: string,
        registryDomain: string,
        registryImagePrefix: string
    ) {
        const self = this

        return Promise.resolve()
            .then(function() {
                if (
                    !id ||
                    !registryUser ||
                    !registryPassword ||
                    !registryDomain
                ) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'User, password and domain are required.'
                    )
                }

                return self.getAllRegistries()
            })
            .then(function(registries) {
                let found = false
                for (let idx = 0; idx < registries.length; idx++) {
                    const element = registries[idx]
                    if (element.id === id) {
                        if (element.registryType === IRegistryTypes.LOCAL_REG) {
                            throw ApiStatusCodes.createError(
                                ApiStatusCodes.ILLEGAL_OPERATION,
                                'You cannot edit self-hosted registry'
                            )
                        }

                        element.registryUser = registryUser
                        element.registryPassword = registryPassword
                        element.registryDomain = registryDomain
                        element.registryImagePrefix = registryImagePrefix
                        found = true
                    }
                }

                if (!found)
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.NOT_FOUND,
                        'Registry ID not found'
                    )

                return self.saveAllRegistries(registries)
            })
    }

    addRegistryToDb(
        registryUser: string,
        registryPassword: string,
        registryDomain: string,
        registryImagePrefix: string,
        registryType: IRegistryType
    ) {
        const self = this

        let savedId: string | undefined = undefined

        return Promise.resolve()
            .then(function() {
                if (
                    !registryUser ||
                    !registryPassword ||
                    !registryDomain ||
                    !registryType
                ) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'User, password and domain are required.'
                    )
                }

                return self.getAllRegistries()
            })
            .then(function(registries) {
                let id: string = uuid()
                let isAlreadyTaken = true

                while (isAlreadyTaken) {
                    id = uuid()
                    isAlreadyTaken = false
                    for (let i = 0; i < registries.length; i++) {
                        if (registries[i].id === id) {
                            isAlreadyTaken = true
                            break
                        }
                    }
                }

                savedId = id
                registries.push({
                    id,
                    registryUser,
                    registryPassword,
                    registryDomain,
                    registryImagePrefix,
                    registryType,
                })

                return self.saveAllRegistries(registries)
            })
            .then(function() {
                if (!savedId)
                    throw new Error(
                        'Saved registry, but ID is null. This should never happen'
                    )
                return savedId
            })
    }

    private saveAllRegistries(registries: IRegistryInfo[]) {
        const self = this
        return Promise.resolve() //
            .then(function() {
                const encryptedList: IRegistryInfoEncrypted[] = []
                for (let i = 0; i < registries.length; i++) {
                    const element = registries[i]
                    encryptedList.push({
                        id: element.id,
                        registryDomain: element.registryDomain,
                        registryImagePrefix: element.registryImagePrefix,
                        registryUser: element.registryUser,
                        registryPasswordEncrypted: self.encryptor.encrypt(
                            element.registryPassword
                        ),
                        registryType: element.registryType,
                    })
                }
                self.data.set(DOCKER_REGISTRIES, encryptedList)
            })
    }
}

export = RegistriesDataStore
