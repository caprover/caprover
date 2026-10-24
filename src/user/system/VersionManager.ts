import axios from 'axios'
import ApiStatusCodes from '../../api/ApiStatusCodes'
import DockerApi from '../../docker/DockerApi'
import CaptainConstants from '../../utils/CaptainConstants'
import { getText } from '../../utils/HttpUtils'
import Logger from '../../utils/Logger'
import DockerRegistryHelper from '../DockerRegistryHelper'

// Minimum Docker API version required by captain releases, as of the release that
// started requiring it (pin bumps: 1.8.0 -> v1.40, 1.12.0 -> v1.43, 1.14.1 -> v1.44).
// The official version API can override these with minDockerApiVersion; the table
// keeps the pre-flight check working for releases the server does not describe yet.
const RELEASE_MIN_DOCKER_API_VERSIONS: Array<{
    sinceRelease: string
    minDockerApiVersion: string
}> = [
    { sinceRelease: '1.14.1', minDockerApiVersion: 'v1.44' },
    { sinceRelease: '1.12.0', minDockerApiVersion: 'v1.43' },
    { sinceRelease: '1.8.0', minDockerApiVersion: 'v1.40' },
]

function isVersionAtLeast(candidate: string, baseline: string) {
    const candidateParts = candidate.replace(/^v/, '').split('.')
    const baselineParts = baseline.replace(/^v/, '').split('.')

    for (let i = 0; i < 3; i++) {
        const candidatePart = Number(candidateParts[i] || 0)
        const baselinePart = Number(baselineParts[i] || 0)

        if (candidatePart !== baselinePart) {
            return candidatePart > baselinePart
        }
    }

    return true
}

function getMinDockerApiVersionForRelease(versionTag: string) {
    for (const releaseRequirement of RELEASE_MIN_DOCKER_API_VERSIONS) {
        if (isVersionAtLeast(versionTag, releaseRequirement.sinceRelease)) {
            return releaseRequirement.minDockerApiVersion
        }
    }

    return undefined
}

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
                        ? data.minDockerApiVersion + ''
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

        return Promise.resolve()
            .then(function () {
                // The startup probe stores the highest Docker API version the
                // host supports. Await the probe before reading it so a request
                // that arrives while the probe is still running does not see an
                // unset version; a probe that failed resolves without setting
                // one and the update keeps the pre-existing behavior.
                return self.dockerApi.hostDockerApiVersionReady.then(
                    function () {
                        return self.dockerApi.hostDockerApiVersion
                    }
                )
            })
            .then(function (hostApiVersion) {
                if (!hostApiVersion) {
                    return undefined
                }

                return self
                    .getMinRequiredDockerApiVersion(versionTag)
                    .then(function (minRequiredApiVersion) {
                        if (
                            minRequiredApiVersion &&
                            !isVersionAtLeast(
                                hostApiVersion,
                                minRequiredApiVersion
                            )
                        ) {
                            throw ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                `Cannot update to Captain ${versionTag}: it requires Docker API ${minRequiredApiVersion}, but this host only supports Docker API ${hostApiVersion}. Please update Docker Engine on the host first.`
                            )
                        }

                        return undefined
                    })
            })
    }

    private getMinRequiredDockerApiVersion(versionTag: string) {
        const self = this

        return Promise.resolve()
            .then(function () {
                // Only the official API can name the requirement of the release
                // it offers. For custom images go straight to the release table.
                if (
                    'caprover/caprover' !==
                    CaptainConstants.configs.publishedNameOnDockerHub
                ) {
                    return undefined
                }

                return self.getCaptainImageTagsFromOfficialApi(
                    CaptainConstants.configs.version
                )
            })
            .then(function (tagsInfo) {
                // The server-provided requirement describes the release it
                // offers: only trust it for exactly that tag.
                if (
                    tagsInfo &&
                    tagsInfo.latestVersion === versionTag &&
                    tagsInfo.minDockerApiVersion
                ) {
                    return tagsInfo.minDockerApiVersion
                }

                return getMinDockerApiVersionForRelease(versionTag)
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
