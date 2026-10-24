import axios from 'axios'
import ApiStatusCodes from '../../api/ApiStatusCodes'
import DockerApi from '../../docker/DockerApi'
import CaptainConstants from '../../utils/CaptainConstants'
import { getText } from '../../utils/HttpUtils'
import Logger from '../../utils/Logger'
import DockerRegistryHelper from '../DockerRegistryHelper'

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
        minDockerApiVersion?: string
    }> {
        // reach out to api.v2.caprover.com/v2/versionInfo?currentVersion=1.5.3
        // response should be currentVersion, latestVersion, canUpdate, and changeLogMessage

        return Promise.resolve() //
            .then(function () {
                return axios.get('https://api-v1.caprover.com/v2/versionInfo', {
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
                    minDockerApiVersion: data.minDockerApiVersion
                        ? String(data.minDockerApiVersion).trim()
                        : undefined,
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

        const tagListPromise = CaptainConstants.isDebug
            ? Promise.resolve(['v0.0.1'])
            : getText(url).then(function (body) {
                  let response: { results?: Array<{ name?: unknown }> } | null

                  try {
                      response = JSON.parse(body)
                  } catch (error) {
                      throw new Error(
                          'Received invalid JSON for version list from Docker Hub.',
                          { cause: error }
                      )
                  }

                  if (!response || !Array.isArray(response.results)) {
                      throw new Error(
                          'Received empty body or no result for version list from Docker Hub.'
                      )
                  }

                  return response.results
                      .map((result) => result.name)
                      .filter(
                          (name): name is string => typeof name === 'string'
                      )
              })

        return tagListPromise.then(function (tagList) {
            const currentVersion = CaptainConstants.configs.version.split('.')
            let latestVersion = CaptainConstants.configs.version.split('.')

            let canUpdate = false

            for (let i = 0; i < tagList.length; i++) {
                const tag = tagList[i].split('.')

                if (tag.length !== 3) {
                    continue
                }

                if (Number(tag[0]) > Number(latestVersion[0])) {
                    canUpdate = true
                    latestVersion = tag
                } else if (
                    Number(tag[0]) === Number(latestVersion[0]) &&
                    Number(tag[1]) > Number(latestVersion[1])
                ) {
                    canUpdate = true
                    latestVersion = tag
                } else if (
                    Number(tag[0]) === Number(latestVersion[0]) &&
                    Number(tag[1]) === Number(latestVersion[1]) &&
                    Number(tag[2]) > Number(latestVersion[2])
                ) {
                    canUpdate = true
                    latestVersion = tag
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

    updateCaptain(
        versionTag: string,
        dockerRegistryHelper: DockerRegistryHelper
    ) {
        const self = this
        const providedImageName = `${CaptainConstants.configs.publishedNameOnDockerHub}:${versionTag}`
        return Promise.resolve()
            .then(function () {
                return self.verifyHostSupportsVersion(versionTag)
            })
            .then(function () {
                return dockerRegistryHelper.getDockerAuthObjectForImageName(
                    providedImageName
                )
            })
            .then(function (authObj) {
                return self.dockerApi.pullImage(providedImageName, authObj)
            })
            .then(function () {
                return self.dockerApi.updateService(
                    CaptainConstants.captainServiceName,
                    providedImageName,
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

    private verifyHostSupportsVersion(versionTag: string) {
        const self = this
        if (
            CaptainConstants.configs.publishedNameOnDockerHub !==
            'caprover/caprover'
        ) {
            return Promise.resolve()
        }

        return self
            .getCaptainImageTagsFromOfficialApi(
                CaptainConstants.configs.version
            )
            .then(function (versionInfo) {
                const minRequiredApiVersion = versionInfo.minDockerApiVersion
                if (
                    versionInfo.latestVersion !== versionTag ||
                    !minRequiredApiVersion
                ) {
                    return
                }

                return self.dockerApi
                    .getHostDockerApiVersion()
                    .then(function (hostApiVersion) {
                        if (
                            hostApiVersion.localeCompare(
                                minRequiredApiVersion.replace(/^v/, ''),
                                undefined,
                                { numeric: true }
                            ) < 0
                        ) {
                            throw ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                `Cannot update to Captain ${versionTag}: it requires Docker API ${minRequiredApiVersion}, but this host only supports Docker API ${hostApiVersion}. Please update Docker Engine on the host first.`
                            )
                        }
                    })
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
