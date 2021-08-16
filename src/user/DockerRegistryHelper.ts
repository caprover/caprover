import ApiStatusCodes from '../api/ApiStatusCodes'
import DataStore from '../datastore/DataStore'
import RegistriesDataStore from '../datastore/RegistriesDataStore'
import DockerApi from '../docker/DockerApi'
import {
    IRegistryInfo,
    IRegistryType,
    IRegistryTypes,
} from '../models/IRegistryInfo'
import { AnyError } from '../models/OtherTypes'
import Logger from '../utils/Logger'
import Utils from '../utils/Utils'
import BuildLog from './BuildLog'

class DockerRegistryHelper {
    private registriesDataStore: RegistriesDataStore
    constructor(dataStore: DataStore, private dockerApi: DockerApi) {
        this.registriesDataStore = dataStore.getRegistriesDataStore()
    }

    retagAndPushIfDefaultPushExist(
        imageName: string,
        version: number,
        buildLogs: BuildLog
    ): Promise<string> {
        const self = this
        let allRegistries: IRegistryInfo[]
        let fullImageName = `${imageName}:${version}`
        return Promise.resolve() //
            .then(function () {
                if (!imageName) throw new Error('no image name! cannot re-tag!')

                if (imageName.indexOf('/') >= 0 || imageName.indexOf(':') >= 0)
                    throw new Error(
                        'ImageName should not contain "/" or ":" before re-tagging!'
                    )

                return self.getAllRegistries()
            })
            .then(function (data) {
                allRegistries = data
                return self.getDefaultPushRegistryId()
            })
            .then(function (defaultRegId) {
                let ret: IRegistryInfo | undefined = undefined
                for (let idx = 0; idx < allRegistries.length; idx++) {
                    const element = allRegistries[idx]
                    if (defaultRegId && element.id === defaultRegId) {
                        return element
                    }
                }
                return ret
            })
            .then(function (data) {
                if (!data) return fullImageName

                const imageNameWithoutDockerAuth = fullImageName

                fullImageName = `${data.registryDomain}/${data.registryImagePrefix}/${fullImageName}`

                return self
                    .getDockerAuthObjectForImageName(fullImageName)
                    .then(function (authObj) {
                        if (!authObj) {
                            throw new Error(
                                'Docker Auth Object is NULL just after re-tagging! Something is wrong!'
                            )
                        }

                        Logger.d('Docker Auth is found. Pushing the image...')

                        return Promise.resolve()
                            .then(function () {
                                return self.dockerApi.retag(
                                    imageNameWithoutDockerAuth,
                                    fullImageName
                                )
                            })
                            .then(function () {
                                return self.dockerApi.pushImage(
                                    fullImageName,
                                    authObj,
                                    buildLogs
                                )
                            })
                            .catch(function (error: AnyError) {
                                return new Promise<void>(function (
                                    resolve,
                                    reject
                                ) {
                                    Logger.e('PUSH FAILED')
                                    Logger.e(error)
                                    reject(
                                        ApiStatusCodes.createError(
                                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                                            `Push failed: ${error}`
                                        )
                                    )
                                })
                            })
                    })
                    .then(function () {
                        return fullImageName
                    })
            })
    }

    getDockerAuthObjectForImageName(
        imageName: string
    ): Promise<DockerAuthObj | undefined> {
        const self = this
        return Promise.resolve() //
            .then(function () {
                //
                return self.getAllRegistries()
            })
            .then(function (regs) {
                for (let index = 0; index < regs.length; index++) {
                    const element = regs[index]
                    const prefix = element.registryImagePrefix
                    const registryIdentifierPrefix =
                        element.registryDomain +
                        (prefix ? `/${prefix}` : '') +
                        '/'

                    if (imageName.startsWith(registryIdentifierPrefix)) {
                        return {
                            serveraddress: element.registryDomain,
                            username: element.registryUser,
                            password: element.registryPassword,
                            // email: CaptainConstants.defaultEmail, // email is optional
                        }
                    }
                }

                // if none of the registries explicitly relates to the image name, and no other explicit domain is defined,
                // try Docker Hub registry as the default
                if (
                    imageName.split('/').length == 2 || // user/image is from Docker Hub
                    imageName.split('/')[0].endsWith('.docker.io') || // registry-1.docker.io/user/image is from Docker Hub
                    imageName.split('/')[0] === 'docker.io' || // registry-1.docker.io/user/image is from Docker Hub
                    imageName.split('/')[0].endsWith('.docker.com') || // hub.docker.com/user/image is from Docker Hub
                    imageName.split('/')[0] === 'docker.io' // hub.docker.com/user/image is from Docker Hub
                )
                    for (let index = 0; index < regs.length; index++) {
                        const element = regs[index]
                        if (element.registryDomain === 'registry-1.docker.io') {
                            return {
                                serveraddress: element.registryDomain,
                                username: element.registryUser,
                                password: element.registryPassword,
                                // email: CaptainConstants.defaultEmail, // email is optional
                            }
                        }
                    }

                return undefined
            })
    }

    createDockerRegistryConfig(): Promise<DockerRegistryConfig> {
        const self = this
        return Promise.resolve() //
            .then(function () {
                //
                return self.getAllRegistries()
            })
            .then(function (regs) {
                let registryConfig: DockerRegistryConfig = {}

                for (let index = 0; index < regs.length; index++) {
                    const element = regs[index]
                    // https://docs.docker.com/engine/api/v1.40/#operation/ImageBuild
                    // For: X-Registry-Config
                    // Only the registry domain name (and port if not the default 443) are required. However,
                    // for legacy reasons, the Docker Hub registry must be specified with both a https:// prefix
                    // and a /v1/ suffix even though Docker will prefer to use the v2 registry API.

                    if (element.registryDomain.indexOf('.docker.io') >= 0) {
                        registryConfig['https://index.docker.io/v1/'] = {
                            username: element.registryUser,
                            password: element.registryPassword,
                        }
                    } else {
                        registryConfig[element.registryDomain] = {
                            username: element.registryUser,
                            password: element.registryPassword,
                        }
                    }
                }

                return registryConfig
            })
    }

    setDefaultPushRegistry(registryId: string) {
        const self = this
        return Promise.resolve().then(function () {
            return self.registriesDataStore.setDefaultPushRegistryId(registryId)
        })
    }

    getDefaultPushRegistryId() {
        const self = this
        return Promise.resolve().then(function () {
            return self.registriesDataStore.getDefaultPushRegistryId()
        })
    }

    deleteRegistry(registryId: string, allowLocalDelete: boolean) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.getDefaultPushRegistryId()
            })
            .then(function (registryIdDefaultPush) {
                if (registryId === registryIdDefaultPush) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'Cannot remove the default push. First change the default push.'
                    )
                }

                return self.registriesDataStore.getRegistryById(registryId)
            })
            .then(function (registry) {
                if (
                    registry.registryType === IRegistryTypes.LOCAL_REG &&
                    !allowLocalDelete
                ) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'You cannot delete self-hosted registry.'
                    )
                }
                return self.registriesDataStore.deleteRegistry(registryId)
            })
    }

    getAllRegistries() {
        const self = this
        return Promise.resolve().then(function () {
            return self.registriesDataStore.getAllRegistries()
        })
    }

    addRegistry(
        registryUser: string,
        registryPassword: string,
        registryDomain: string,
        registryImagePrefix: string,
        registryType: IRegistryType
    ) {
        const self = this

        return Promise.resolve()
            .then(function () {
                registryDomain = Utils.removeHttpHttps(registryDomain)

                if (registryType === IRegistryTypes.LOCAL_REG) {
                    // We don't check the auth details for local registry. We create it, we know it's correct!
                    return
                }

                return self.ensureAuthenticationForRegistry(
                    registryUser,
                    registryPassword,
                    registryDomain
                )
            })
            .then(function () {
                return self.registriesDataStore.getAllRegistries()
            })
            .then(function (allRegs) {
                let promiseToAddRegistry = self.registriesDataStore.addRegistryToDb(
                    registryUser,
                    registryPassword,
                    registryDomain,
                    registryImagePrefix,
                    registryType
                )

                // Product decision. We want to make the first added registry the default one,
                // this way, it's easier for new users to grasp the concept of default push registry.
                if (allRegs.length === 0) {
                    promiseToAddRegistry = promiseToAddRegistry //
                        .then(function (idOfNewReg) {
                            return self.registriesDataStore
                                .setDefaultPushRegistryId(idOfNewReg)
                                .then(function () {
                                    return idOfNewReg
                                })
                        })
                }

                return promiseToAddRegistry
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
            .then(function () {
                registryDomain = Utils.removeHttpHttps(registryDomain)

                return self.ensureAuthenticationForRegistry(
                    registryUser,
                    registryPassword,
                    registryDomain
                )
            })
            .then(function () {
                return self.registriesDataStore.updateRegistry(
                    id,
                    registryUser,
                    registryPassword,
                    registryDomain,
                    registryImagePrefix
                )
            })
    }

    private ensureAuthenticationForRegistry(
        registryUser: string,
        registryPassword: string,
        registryDomain: string
    ): any {
        const self = this
        return self.dockerApi
            .checkRegistryAuth({
                username: registryUser,
                password: registryPassword,
                serveraddress: registryDomain,
            })
            .catch(function (err) {
                Logger.e(err)
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.AUTHENTICATION_FAILED,
                    'Authentication failed. Either username, password or domain is incorrect.'
                )
            })
    }
}

export default DockerRegistryHelper
