import axios from 'axios'
import ApiStatusCodes from '../../api/ApiStatusCodes'
import ProDataStore from '../../datastore/ProDataStore'
import { IProConfig, IProFeatures } from '../../models/IProFeatures'
import CaptainConstants from '../../utils/CaptainConstants'
import EnvVars from '../../utils/EnvVars'
import Logger from '../../utils/Logger'
import FeatureFlags from '../FeatureFlags'
import { CapRoverEventType, ICapRoverEvent } from './../events/ICapRoverEvent'

type API_METHOD = 'post' | 'get'

const API_KEY_HEADER = 'x-api-key'

export default class ProManager {
    private static activeApiIndex = Math.floor(Math.random() * 2)

    constructor(
        private proDataStore: ProDataStore,
        private featureFlagsProvider: FeatureFlags
    ) {
        //
    }

    private static incrementApiDomain() {
        this.activeApiIndex++
    }

    private static getBaseUrl() {
        return (
            CaptainConstants.configs.proApiDomains[
                ProManager.activeApiIndex %
                    CaptainConstants.configs.proApiDomains.length
            ] + '/api/v1'
        )
    }

    private callApi(
        method: API_METHOD,
        path: string,
        data: any,
        apiKeyOverride?: string
    ) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.getHeaders(apiKeyOverride)
            })
            .then(function (headers) {
                return axios({
                    method: method,
                    data: data,
                    url: ProManager.getBaseUrl() + path,
                    headers: headers,
                })
            })
            .then(function (axiosResponse) {
                return axiosResponse.data // actual HTTP response data
            })
            .then(function (data) {
                if (data.status === 1100) {
                    return self.proDataStore
                        .clearAllProConfigs() //
                        .then(function () {
                            throw ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_ERROR_PRO_API_KEY_INVALIDATED,
                                'Invalid API Key, removing API Key from the config'
                            )
                        })
                }

                if (data.status && data.status !== 100) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        data.description
                    )
                }

                if (!data.data) throw new Error('Unexpected Pro API response')
                return data.data // pulling out data part of CapRover Pro API response
            })
            .catch((err) => {
                Logger.e(err)

                if (err.captainErrorType) {
                    throw err
                }

                // only switch to the backup instance if the main instance is throwing unknown error
                ProManager.incrementApiDomain()

                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    `Pro API failed`
                )
            })
    }

    private getHeaders(apiKeyOverride?: string): any {
        const self = this
        return Promise.resolve()
            .then(function () {
                return apiKeyOverride
                    ? apiKeyOverride
                    : self.proDataStore.getApiKey()
            })
            .then(function (apiKey) {
                return self.proDataStore
                    .getInstallationId()
                    .then(function (installationId) {
                        const allHeaders = {
                            'x-caprover-version':
                                CaptainConstants.configs.version,
                            'x-installation-id': installationId,
                        } as any

                        allHeaders[API_KEY_HEADER] = apiKey

                        return allHeaders
                    })
            })
    }

    getState(): Promise<IProFeatures> {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.proDataStore.getApiKey()
            })
            .then(function (apiKey) {
                const flags = self.featureFlagsProvider.getFeatureFlags()
                return {
                    isSubscribed: !!apiKey,
                    isFeatureFlagEnabled:
                        !!EnvVars.CAPTAIN_IS_DEBUG || //
                        !!apiKey || // if API key is there, assume feature flag is enabled
                        !!EnvVars.FORCE_ENABLE_PRO || //
                        (flags && flags[FeatureFlags.IS_PRO_ENABLED]),
                }
            })
    }

    verifyToken(tokenSuppliedByClient: string) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.callApi('post', `/caprover/otp/validate`, {
                    token: tokenSuppliedByClient,
                })
            })
            .then(function (data) {
                return !!data.isValid
            })
    }

    validateApiKey(apiKey: string, instanceUrl: string) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.callApi(
                    'post',
                    `/caprover/claim`,
                    {
                        instanceUrl,
                    },
                    apiKey
                )
            })
            .then(function (data) {
                return !!data.isApiKeyOk
            })
    }

    regenerateSecret() {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.callApi('post', `/caprover/otp/secret`, {})
            })
            .then(function (data) {
                return data ? `${data.otpPath || ''}` : ''
            })
    }

    getConfig(): Promise<IProConfig> {
        const self = this
        return Promise.resolve().then(function () {
            return self.proDataStore.getConfig()
        })
    }
    updateConfig(proConfigs: IProConfig): Promise<void> {
        const self = this
        return Promise.resolve() //
            .then(function () {
                return self.getConfig()
            })
            .then(function (oldConfig) {
                return self.proDataStore
                    .updateConfig(proConfigs)
                    .then(function () {
                        return self.callApi('post', `/caprover/configs`, {
                            proConfigs: proConfigs,
                        })
                    })
                    .catch((err) => {
                        Logger.e(err)
                        if (
                            err.captainErrorType ===
                            ApiStatusCodes.STATUS_ERROR_PRO_API_KEY_INVALIDATED
                        ) {
                            return // do not revert the config if the API key is invalidated
                        }
                        return self.proDataStore
                            .updateConfig(oldConfig)
                            .then(function () {
                                throw err
                            })
                    })
            })
            .then(function () {
                //
            })
    }

    reportEvent(event: ICapRoverEvent) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.callApi('post', `/caprover/event`, { event })
            })
            .catch((err) => {
                Logger.e(err)
            })
    }

    isEventEnabledForProReporting(event: ICapRoverEvent): boolean {
        switch (event.eventType) {
            case CapRoverEventType.AppBuildFailed:
            case CapRoverEventType.UserLoggedIn:
            case CapRoverEventType.AppBuildSuccessful:
                return true

            case CapRoverEventType.InstanceStarted:
            case CapRoverEventType.OneClickAppDetailsFetched:
            case CapRoverEventType.OneClickAppListFetched:
                return false
        }
    }

    reportUnAuthAnalyticsEvent(event: ICapRoverEvent) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.getHeaders()
            })
            .then(function (headers) {
                headers[API_KEY_HEADER] = ''
                return axios({
                    method: 'post',
                    data: { event },
                    url: `${CaptainConstants.configs.analyticsDomain}/api/v1/analytics/event`,
                    headers: headers,
                })
            })
            .then(function (axiosResponse) {
                return axiosResponse.data // actual HTTP response data
            })
            .then(function (data) {
                if (data.status && data.status !== 100) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        data.description
                    )
                }

                if (!data.data) throw new Error('Unexpected Pro API response')
                return data.data // pulling out data part of CapRover Pro API response
            })
            .catch((err) => {
                Logger.e(err, 'reportUnAuthAnalyticsEvent failed!')
            })
    }
}
