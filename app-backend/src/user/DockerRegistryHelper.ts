import DataStore = require('../datastore/DataStore')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import Logger = require('../utils/Logger')
import CaptainConstants = require('../utils/CaptainConstants')
import DockerApi = require('../docker/DockerApi')
import BuildLog = require('./BuildLog')
import { AnyError } from '../models/OtherTypes'

class DockerRegistryHelper {
    constructor(private dataStore: DataStore, private dockerApi: DockerApi) {
        //
    }

    retagAndPushIfDefaultPushExist(
        imageName: string,
        version: number,
        buildLogs: BuildLog
    ): Promise<string> {
        const self = this
        let allRegistries: IRegistryInfo[]
        let fullImageName = imageName + ':' + version
        return Promise.resolve() //
            .then(function() {
                if (!imageName) throw new Error('no image name! cannot re-tag!')

                if (imageName.indexOf('/') >= 0 || imageName.indexOf(':') >= 0)
                    throw new Error(
                        'ImageName should not contain "/" or ":" before re-tagging!'
                    )

                return self.getAllRegistries()
            })
            .then(function(data) {
                allRegistries = data
                return self.getDefaultPushRegistry()
            })
            .then(function(defaultRegId) {
                let ret: IRegistryInfo | undefined = undefined
                for (let idx = 0; idx < allRegistries.length; idx++) {
                    const element = allRegistries[idx]
                    if (defaultRegId && element.id === defaultRegId) {
                        return element
                    }
                }
                return ret
            })
            .then(function(data) {
                if (!data) return fullImageName

                fullImageName =
                    data.registryDomain +
                    '/' +
                    data.registryImagePrefix +
                    '/' +
                    fullImageName

                return self
                    .getDockerAuthObjectForImageName(fullImageName)
                    .then(function(authObj) {
                        if (!authObj) {
                            throw new Error(
                                'Docker Auth Object is NULL just after re-tagging! Something is wrong!'
                            )
                        }

                        Logger.d('Docker Auth is found. Pushing the image...')

                        return self.dockerApi
                            .pushImage(fullImageName, authObj, buildLogs)
                            .catch(function(error: AnyError) {
                                return new Promise<
                                    void
                                >(function(resolve, reject) {
                                    Logger.e('PUSH FAILED')
                                    Logger.e(error)
                                    reject(
                                        ApiStatusCodes.createError(
                                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                                            'Push failed: ' + error
                                        )
                                    )
                                })
                            })
                    })
                    .then(function() {
                        return fullImageName
                    })
            })
    }

    getDockerAuthObjectForImageName(
        imageName: string
    ): Promise<DockerAuthObj | undefined> {
        const self = this
        return Promise.resolve() //
            .then(function() {
                //
                return self.getAllRegistries()
            })
            .then(function(regs) {
                for (let index = 0; index < regs.length; index++) {
                    const element = regs[index]
                    const prefix = element.registryImagePrefix
                    const registryIdentifierPrefix =
                        element.registryDomain +
                        (prefix ? '/' + prefix : '') +
                        '/'

                    if (imageName.startsWith(registryIdentifierPrefix)) {
                        return {
                            serveraddress: element.registryDomain,
                            username: element.registryUser,
                            password: element.registryPassword,
                            email: CaptainConstants.defaultEmail, // TODO??
                        }
                    }
                }
                return undefined
            })
    }

    setDefaultPushRegistry(registryId: string) {
        const self = this
        return Promise.resolve().then(function() {
            return self.dataStore.setDefaultPushRegistry(registryId)
        })
    }

    getDefaultPushRegistry() {
        const self = this
        return Promise.resolve().then(function() {
            return self.dataStore.getDefaultPushRegistry()
        })
    }

    deleteRegistry(registryId: string) {
        const self = this
        return Promise.resolve()
            .then(function() {
                return self.getDefaultPushRegistry()
            })
            .then(function(registryIdDefaultPush) {
                if (registryId === registryIdDefaultPush) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'Cannot remove the default push'
                    )
                }

                return self.dataStore.deleteRegistry(registryId)
            })
    }

    getAllRegistries() {
        const self = this
        return Promise.resolve().then(function() {
            return self.dataStore.getAllRegistries()
        })
    }

    addRegistry(
        registryUser: string,
        registryPassword: string,
        registryDomain: string,
        registryImagePrefix: string
    ) {
        const self = this
        return Promise.resolve().then(function() {
            if (!registryUser || !registryPassword || !registryDomain) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'User, password and domain are required.'
                )
            }

            return self.dataStore.addRegistryToDb(
                registryUser,
                registryPassword,
                registryDomain,
                registryImagePrefix
            )
        })
    }
}

export = DockerRegistryHelper
