import request = require('request')
import axios from 'axios'
import DockerApi from '../../docker/DockerApi'
import CaptainConstants from '../../utils/CaptainConstants'
import Logger from '../../utils/Logger'

class VersionManager {
    private dockerApi: DockerApi

    constructor() {
        const dockerApi = DockerApi.get()
        this.dockerApi = dockerApi
    }
    private getCaptainImageTagsFromOfficialApi(
        currentVersion: string
    ): Promise<{
        currentVersion: string
        latestVersion: string
        changeLogMessage: string
        canUpdate: boolean
    }> {
        // reach out to api.v2.caprover.com/v2/versionInfo?currentVersion=1.5.3
        // response should be currentVersion, latestVersion, canUpdate, and changeLogMessage

        return Promise.resolve() //
            .then(function () {
                return axios.get('https://api.v2.caprover.com/v2/versionInfo', {
                    params: {
                        currentVersion: currentVersion,
                    },
                })
            })
            .then(function (responseObj) {
                const resp = responseObj.data

                if (resp.status !== 100) {
                    throw new Error(
                        `Bad response from the upstream version info: ${resp.status}`
                    )
                }

                const data = resp.data

                return {
                    currentVersion: data.currentVersion + '',
                    latestVersion: data.latestVersion + '',
                    changeLogMessage: data.changeLogMessage + '',
                    canUpdate: !!data.canUpdate,
                }
            })
            .catch(function (error) {
                Logger.e(error)
                return Promise.resolve({
                    currentVersion: currentVersion + '',
                    latestVersion: currentVersion + '',
                    changeLogMessage: '',
                    canUpdate: false,
                })
            })
    }

    getCaptainImageTags() {
        if (
            'caprover/caprover' ===
            CaptainConstants.configs.publishedNameOnDockerHub
        ) {
            // For the official image use our official API.
            return this.getCaptainImageTagsFromOfficialApi(
                CaptainConstants.configs.version
            )
        }

        // Fallback for unofficial images to DockerHub, knowing that:
        // - The API contract is not guaranteed to always be the same, it might break in the future
        // - This method does not return the changeLogMessage

        const url = `https://hub.docker.com/v2/repositories/${CaptainConstants.configs.publishedNameOnDockerHub}/tags`

        return new Promise<string[]>(function (resolve, reject) {
            request(
                url,

                function (error, response, body) {
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
        }).then(function (tagList) {
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
                changeLogMessage: '',
            }
        })
    }

    updateCaptain(versionTag: string) {
        const self = this
        return Promise.resolve().then(function () {
            return self.dockerApi.updateService(
                CaptainConstants.captainServiceName,
                `${CaptainConstants.configs.publishedNameOnDockerHub}:${versionTag}`,
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
