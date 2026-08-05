import express = require('express')
import axios from 'axios'
import ApiStatusCodes from '../../../api/ApiStatusCodes'
import BaseApi from '../../../api/BaseApi'
import InjectionExtractor from '../../../injection/InjectionExtractor'
import { EventLogger } from '../../../user/events/EventLogger'
import {
    CapRoverEventFactory,
    CapRoverEventType,
} from '../../../user/events/ICapRoverEvent'
import OneClickAppDeployManager from '../../../user/oneclick/OneClickAppDeployManager'
import { OneClickDeploymentJobRegistry } from '../../../user/oneclick/OneClickDeploymentJobRegistry'
import CaptainConstants from '../../../utils/CaptainConstants'
import Logger from '../../../utils/Logger'

const router = express.Router()
const DEFAULT_ONE_CLICK_BASE_URL = 'https://oneclickapps.caprover.com'

const VERSION = `v4`

const HEADERS = {} as any
HEADERS[CaptainConstants.headerCapRoverVersion] =
    CaptainConstants.configs.version

interface IOneClickAppIdentifier {
    baseUrl: string
    isOfficial: boolean
    name: string
    displayName: string
    description: string
    logoUrl: string
}

router.post('/repositories/insert', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore
    let apiBaseUrl = `${req.body.repositoryUrl || ''}`
    if (apiBaseUrl.endsWith('/')) {
        apiBaseUrl = apiBaseUrl.substring(0, apiBaseUrl.length - 1)
    }

    return Promise.resolve() //
        .then(function () {
            return dataStore.getAllOneClickBaseUrls()
        })
        .then(function (urls) {
            if (urls.indexOf(apiBaseUrl) >= 0)
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    `Repository URL already exists: ${apiBaseUrl}`
                )

            return axios
                .get(apiBaseUrl + `/${VERSION}/list`)
                .then(function (axiosResponse) {
                    return axiosResponse.data.oneClickApps as any[]
                })
                .then(function (apps: any[]) {
                    if (!apps || !apps.length)
                        throw new Error(
                            `No apps were retrieved from ${apiBaseUrl}`
                        )
                })
                .catch((err) => {
                    Logger.e(err)
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        `Could not fetch app lists from ${apiBaseUrl}`
                    )
                })
        })
        .then(function () {
            return dataStore.insertOneClickBaseUrl(apiBaseUrl)
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                `One Click apps repository URL is saved: ${apiBaseUrl}`
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/repositories/delete', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore
    let apiBaseUrl = `${req.body.repositoryUrl || ''}`
    if (apiBaseUrl.endsWith('/')) {
        apiBaseUrl = apiBaseUrl.substring(0, apiBaseUrl.length - 1)
    }

    return Promise.resolve() //
        .then(function () {
            return dataStore.getAllOneClickBaseUrls()
        })
        .then(function (urls) {
            if (urls.indexOf(apiBaseUrl) < 0)
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    `Repository URL does not exist ${apiBaseUrl}`
                )
        })
        .then(function () {
            return dataStore.deleteOneClickBaseUrl(apiBaseUrl)
        })
        .then(function () {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                `One Click apps repository URL is deleted ${apiBaseUrl}`
            )
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/repositories/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    return Promise.resolve() //
        .then(function () {
            return dataStore.getAllOneClickBaseUrls()
        })
        .then(function (urls) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'One click repositories are retrieved '
            )
            baseApi.data = {}
            baseApi.data.urls = urls
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/template/list', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore
    const eventLogger =
        InjectionExtractor.extractUserFromInjected(res).user.userManager
            .eventLogger

    return Promise.resolve() //
        .then(function () {
            return dataStore.getAllOneClickBaseUrls()
        })
        .then(function (urls) {
            urls.push(DEFAULT_ONE_CLICK_BASE_URL)
            const promises = [] as Promise<IOneClickAppIdentifier[]>[]

            eventLogger.trackEvent(
                CapRoverEventFactory.create(
                    CapRoverEventType.OneClickAppListFetched,
                    {
                        numberOfRepos: urls.length,
                    }
                )
            )

            urls.forEach((apiBaseUrl) => {
                const p = axios({
                    method: 'get',
                    url: apiBaseUrl + `/${VERSION}/list`,
                    headers: HEADERS,
                })
                    .then(function (axiosResponse) {
                        return axiosResponse.data.oneClickApps as any[]
                    })
                    .then(function (apps: any[]) {
                        return apps.map((element) => {
                            const ret: IOneClickAppIdentifier = {
                                baseUrl: apiBaseUrl,
                                name: element.name,
                                displayName: `${element.displayName}`,
                                isOfficial:
                                    (element.isOfficial + '').toLowerCase() ===
                                    'true',
                                description: `${element.description}`,
                                logoUrl:
                                    element.logoUrl &&
                                    (element.logoUrl.startsWith('http://') ||
                                        element.logoUrl.startsWith('https://'))
                                        ? element.logoUrl
                                        : `${apiBaseUrl}/${VERSION}/logos/${element.logoUrl}`,
                            }
                            return ret
                        })
                    })
                    .catch((err) => {
                        Logger.e(err)
                        return [] as IOneClickAppIdentifier[]
                    })

                promises.push(p)
            })

            return Promise.all(promises)
        })
        .then(function (arrayOfArrays) {
            const allApps = [] as IOneClickAppIdentifier[]
            arrayOfArrays.map((appsFromBase) => {
                return allApps.push(...appsFromBase)
            })
            return allApps
        })
        .then(function (allApps) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'All one click apps are retrieved'
            )
            baseApi.data = {}
            baseApi.data.oneClickApps = allApps
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/template/app', function (req, res, next) {
    const baseDomain = req.query.baseDomain as string
    const appName = req.query.appName as string
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore
    const eventLogger =
        InjectionExtractor.extractUserFromInjected(res).user.userManager
            .eventLogger

    return Promise.resolve() //
        .then(function () {
            return dataStore.getAllOneClickBaseUrls()
        })
        .then(function (urls) {
            urls.push(DEFAULT_ONE_CLICK_BASE_URL)
            if (urls.indexOf(baseDomain) < 0)
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'Unknown base URL '
                )

            const appUrl = `${baseDomain}/${VERSION}/apps/${appName}`
            Logger.d(`retrieving app at: ${appUrl}`)

            // Only log the official repo events
            if (baseDomain === DEFAULT_ONE_CLICK_BASE_URL) {
                eventLogger.trackEvent(
                    CapRoverEventFactory.create(
                        CapRoverEventType.OneClickAppDetailsFetched,
                        {
                            appName,
                        }
                    )
                )
            }

            return axios({
                method: 'get',
                url: appUrl,
                headers: HEADERS,
            }).then(function (responseObject) {
                return responseObject.data
            })
        })
        .then(function (appTemplate) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App template is retrieved'
            )
            baseApi.data = {}
            baseApi.data.appTemplate = appTemplate
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/deploy', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager
    const eventLogger =
        InjectionExtractor.extractUserFromInjected(res).user.userManager
            .eventLogger

    const template = req.body.template
    const values = req.body.values
    const templateName = req.body.templateName
    const deploymentJobRegistry = OneClickDeploymentJobRegistry.getInstance()

    return Promise.resolve() //
        .then(function () {
            if (!template) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'Template is required'
                )
            }

            const jobId = deploymentJobRegistry.createJob()

            reportAnalyticsOnAppDeploy(templateName, template, eventLogger)

            new OneClickAppDeployManager(
                dataStore,
                serviceManager,
                (deploymentState) => {
                    deploymentJobRegistry.updateJobProgress(
                        jobId,
                        deploymentState
                    )
                    Logger.dev(`Deployment state updated for jobId: ${jobId}`)
                    Logger.dev(
                        `Deployment state: ${JSON.stringify(deploymentState, null, 2)}`
                    )
                }
            ).startDeployProcess(template, values)

            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'One-click deployment started'
            )
            baseApi.data = { jobId }
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/deploy/progress', function (req, res, next) {
    const jobId = req.query.jobId as string
    const deploymentJobRegistry = OneClickDeploymentJobRegistry.getInstance()

    return Promise.resolve() //
        .then(function () {
            // Validate input
            if (!jobId) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'Job ID is required'
                )
            }

            // Check if job exists
            if (!deploymentJobRegistry.jobExists(jobId)) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'Job ID not found'
                )
            }

            Logger.d(`Getting deployment progress for jobId: ${jobId}`)

            // Get the current job state from deployment manager
            const jobState = deploymentJobRegistry.getJobState(jobId)

            if (!jobState) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    'Unable to retrieve job state'
                )
            }

            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Deployment progress retrieved'
            )
            baseApi.data = jobState
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router

// This function analyzes the provided template to identify any unused fields in Docker service definitions.
// It then logs an analytics event with the unused fields and the template name (if it's an official or known template).
// This helps track which fields users are using and may inform future improvements to the one-click app templates.
export function reportAnalyticsOnAppDeploy(
    templateName: any,
    template: any,
    eventLogger: EventLogger
) {
    const unusedDockerServiceFieldNames: string[] = []
    if (
        templateName === 'TEMPLATE_ONE_CLICK' ||
        templateName === 'DOCKER_COMPOSE'
    ) {
        if (template?.services) {
            template.services.forEach((service: any) => {
                if (service && typeof service === 'object') {
                    Object.keys(service).forEach((key) => {
                        if (
                            !'image,environment,ports,volumes,depends_on,hostname,command,cap_add'
                                .split(',')
                                .includes(key)
                        ) {
                            // log the unused keys so that we can track what to add next
                            if (!unusedDockerServiceFieldNames.includes(key)) {
                                unusedDockerServiceFieldNames.push(key)
                            }
                        }
                    })
                }
            })
        }
    }

    // we do not want to log private repos names
    const templateNameToReport =
        templateName === 'TEMPLATE_ONE_CLICK' ||
        templateName === 'DOCKER_COMPOSE' ||
        (typeof templateName === 'string' &&
            templateName.startsWith('OFFICIAL_'))
            ? templateName
            : 'UNKNOWN'

    eventLogger.trackEvent(
        CapRoverEventFactory.create(
            CapRoverEventType.OneClickAppDeployStarted,
            {
                unusedFields: unusedDockerServiceFieldNames,
                templateName: templateNameToReport,
            }
        )
    )
}
