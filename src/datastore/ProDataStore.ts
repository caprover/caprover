import configstore = require('configstore')
import { v4 as uuid } from 'uuid'
import { IProConfig } from '../models/IProFeatures'
import ProManagerUtils from '../user/pro/ProManagerUtils'

const IS_OTP_ENABLED = 'isOtpEnabled'
const PRO_API_KEY = 'proApiKey'
const PRO_CONFIGS = 'proConfigs'
const INSTALLATION_ID = 'installationId'

const PRO_PREFIX = 'pro'

function getDataKey(key: string) {
    return PRO_PREFIX + '.' + key
}

class ProDataStore {
    constructor(private data: configstore) {}

    isOtpEnabled(): Promise<boolean> {
        const self = this
        return Promise.resolve().then(function () {
            return !!self.data.get(getDataKey(IS_OTP_ENABLED))
        })
    }

    setOtpEnabled(isEnabled: boolean) {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.set(getDataKey(IS_OTP_ENABLED), !!isEnabled)
        })
    }

    getApiKey() {
        const self = this
        return Promise.resolve().then(function () {
            return `${self.data.get(getDataKey(PRO_API_KEY)) || ''}`
        })
    }

    getInstallationId() {
        const self = this
        return Promise.resolve()
            .then(function () {
                return `${self.data.get(getDataKey(INSTALLATION_ID)) || ''}`
            })
            .then(function (installationId) {
                if (installationId) return installationId

                const newId = uuid()
                self.data.set(getDataKey(INSTALLATION_ID), newId)
                return newId
            })
    }

    clearAllProConfigs() {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.delete(PRO_PREFIX)
        })
    }

    setApiKey(apiKey: string) {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.set(getDataKey(PRO_API_KEY), `${apiKey}`)
        })
    }

    getConfig(): Promise<IProConfig> {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.data.get(getDataKey(PRO_CONFIGS))
            })
            .then(function (pc) {
                return ProManagerUtils.ensureProConfigType(pc)
            })
    }

    updateConfig(proConfig: IProConfig): Promise<void> {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.set(getDataKey(PRO_CONFIGS), proConfig)
        })
    }
}

export default ProDataStore
