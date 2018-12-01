class DockerRegistryHelper {
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
}

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
