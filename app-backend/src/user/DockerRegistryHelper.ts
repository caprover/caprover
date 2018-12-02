import DataStore = require('../datastore/DataStore')
import ApiStatusCodes = require('../api/ApiStatusCodes')

class DockerRegistryHelper {
    constructor(private dataStore: DataStore) {
        //
    }

    retagAndPushIfDefaultPushExist(
        imageName: string,
        version: number
    ): Promise<string> {
        return Promise.resolve() //
            .then(function() {
                //
                return ''
            })
    }

    getDockerAuthObjectForImageName(
        imageName: string
    ): Promise<DockerAuthObj | undefined> {
        return Promise.resolve() //
            .then(function() {
                //
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
            return self.dataStore.getAllRegistries() || []
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

/**
 * 
 
 
                const authObj = CaptainManager.get().getDockerAuthObject()

                if (!authObj) {
                    Logger.d(
                        'No Docker Auth is found. Skipping pushing the image.'
                    )
                    return Promise.resolve()
                }

                Logger.d('Docker Auth is found. Pushing the image...')

                return dockerApi
                    .pushImage(
                        imageName,
                        newVersion,
                        authObj,
                        self.buildLogs[appName]
                    )
                    .catch(function(error: AnyError) {
                        return new Promise<void>(function(resolve, reject) {
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


 */
