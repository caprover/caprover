import request = require('request')
import CaptainConstants = require('../../utils/CaptainConstants')
import DockerApi from '../../docker/DockerApi'

class VersionManager {
    private dockerApi: DockerApi

    constructor() {
        const dockerApi = DockerApi.get()
        this.dockerApi = dockerApi
    }

    getCaptainImageTags() {
        const url =
            'https://hub.docker.com/v2/repositories/' +
            CaptainConstants.configs.publishedNameOnDockerHub +
            '/tags'

        return new Promise<string[]>(function(resolve, reject) {
            request(
                url,

                function(error, response, body) {
                    if (CaptainConstants.isDebug) {
                        resolve(['v0.0.1'])
                        return
                    }

                    if (error) {
                        reject(error)
                    } else if (!body || !JSON.parse(body).results) {
                        reject(
                            new Error(
                                'Received empty body or no result for version list on docker hub.'
                            )
                        )
                    } else {
                        const results = JSON.parse(body).results
                        const tags = []
                        for (let idx = 0; idx < results.length; idx++) {
                            tags.push(results[idx].name)
                        }
                        resolve(tags)
                    }
                }
            )
        }).then(function(tagList) {
            let currentVersion = CaptainConstants.configs.version.split('.')
            let latestVersion = CaptainConstants.configs.version.split('.')

            let canUpdate = false

            for (let i = 0; i < tagList.length; i++) {
                let tag = tagList[i].split('.')

                if (tag.length !== 3) {
                    continue
                }

                if (Number(tag[0]) > Number(currentVersion[0])) {
                    canUpdate = true
                    latestVersion = tag
                    break
                } else if (
                    Number(tag[0]) === Number(currentVersion[0]) &&
                    Number(tag[1]) > Number(currentVersion[1])
                ) {
                    canUpdate = true
                    latestVersion = tag
                    break
                } else if (
                    Number(tag[0]) === Number(currentVersion[0]) &&
                    Number(tag[1]) === Number(currentVersion[1]) &&
                    Number(tag[2]) > Number(currentVersion[2])
                ) {
                    canUpdate = true
                    latestVersion = tag
                    break
                }
            }

            return {
                currentVersion: currentVersion.join('.'),
                latestVersion: latestVersion.join('.'),
                canUpdate: canUpdate,
            }
        })
    }

    updateCaptain(versionTag: string) {
        const self = this
        return Promise.resolve().then(function() {
            return self.dockerApi.updateService(
                CaptainConstants.captainServiceName,
                CaptainConstants.configs.publishedNameOnDockerHub +
                    ':' +
                    versionTag,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined
            )
        })
    }

    private static captainManagerInstance: VersionManager | undefined

    static get(): VersionManager {
        if (!VersionManager.captainManagerInstance) {
            VersionManager.captainManagerInstance = new VersionManager()
        }
        return VersionManager.captainManagerInstance
    }
}

export default VersionManager
