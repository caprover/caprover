/**
 * Created by kasra on 27/06/17.
 */
import Configstore = require('configstore')
import fs = require('fs-extra')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import CaptainConstants = require('../utils/CaptainConstants')
import Logger = require('../utils/Logger')
import Encryptor = require('../utils/Encryptor')
import AppsDataStore = require('./AppsDataStore')
import RegistriesDataStore = require('./RegistriesDataStore')

const NAMESPACE = 'namespace'
const HASHED_PASSWORD = 'hashedPassword'
const CUSTOM_DOMAIN = 'customDomain'
const HAS_ROOT_SSL = 'hasRootSsl'
const FORCE_ROOT_SSL = 'forceRootSsl'
const HAS_REGISTRY_SSL = 'hasRegistrySsl'
const EMAIL_ADDRESS = 'emailAddress'
const NET_DATA_INFO = 'netDataInfo'
const NGINX_BASE_CONFIG = 'NGINX_BASE_CONFIG'
const NGINX_CAPTAIN_CONFIG = 'NGINX_CAPTAIN_CONFIG'
const DEFAULT_CAPTAIN_ROOT_DOMAIN = 'captain.localhost'

const DEFAULT_NGINX_BASE_CONFIG = fs
    .readFileSync(__dirname + '/../../template/base-nginx-conf.ejs')
    .toString()
const DEFAULT_NGINX_CAPTAIN_CONFIG = fs
    .readFileSync(__dirname + '/../../template/root-nginx-conf.ejs')
    .toString()
const DEFAULT_NGINX_CONFIG_FOR_APP = fs
    .readFileSync(__dirname + '/../../template/server-block-conf.ejs')
    .toString()

class DataStore {
    private encryptor: Encryptor.CaptainEncryptor
    private namespace: string
    private data: Configstore
    private appsDataStore: AppsDataStore
    private registriesDataStore: RegistriesDataStore

    constructor(namespace: string) {
        const data = new Configstore('captain-store', {})
        data.path = CaptainConstants.captainRootDirectory + '/config.conf'

        this.data = data
        this.namespace = namespace
        this.data.set(NAMESPACE, namespace)
        this.appsDataStore = new AppsDataStore(this.data, namespace)
        this.registriesDataStore = new RegistriesDataStore(this.data, namespace)
    }

    setEncryptionSalt(salt: string) {
        this.encryptor = new Encryptor.CaptainEncryptor(this.namespace + salt)
        this.appsDataStore.setEncryptor(this.encryptor)
        this.registriesDataStore.setEncryptor(this.encryptor)
    }

    getNameSpace(): string {
        return this.data.get(NAMESPACE)
    }

    setHashedPassword(newHashedPassword: string) {
        const self = this
        return Promise.resolve().then(function() {
            return self.data.set(HASHED_PASSWORD, newHashedPassword)
        })
    }

    getHashedPassword() {
        const self = this
        return Promise.resolve().then(function() {
            return self.data.get(HASHED_PASSWORD)
        })
    }

    /*
			"smtp": {
				"to": "",
				"hostname": "",
				"server": "",
				"port": "",
				"allowNonTls": false,
				"password": "",
				"username": ""
			},
			"slack": {
				"hook": "",
				"channel": ""
			},
			"telegram": {
				"botToken": "",
				"chatId": ""
			},
			"pushBullet": {
				"fallbackEmail": "",
				"apiToken": ""
			}
     */
    getNetDataInfo() {
        const self = this
        return Promise.resolve().then(function() {
            const netDataInfo = self.data.get(NET_DATA_INFO) || {}
            netDataInfo.isEnabled = netDataInfo.isEnabled || false
            netDataInfo.data = netDataInfo.data || {}
            return netDataInfo
        })
    }

    setNetDataInfo(netDataInfo: NetDataInfo) {
        const self = this
        return Promise.resolve().then(function() {
            return self.data.set(NET_DATA_INFO, netDataInfo)
        })
    }

    //TODO lookup usage of this method
    getImageNameAndTag(appName: string, version: number) {
        let versionStr = '' + version
        if (version === 0) {
            versionStr = '0'
        }

        return (
            this.getImageNameBase(appName) +
            appName +
            (versionStr ? ':' + versionStr : '')
        )
    }

    getImageNameBase(appName: string) {
        return 'img-' + this.getNameSpace() + '--' + appName
    }

    getRootDomain() {
        return this.data.get(CUSTOM_DOMAIN) || DEFAULT_CAPTAIN_ROOT_DOMAIN
    }

    hasCustomDomain() {
        return !!this.data.get(CUSTOM_DOMAIN)
    }

    getServerList() {
        const self = this

        let hasRootSsl: boolean
        let rootDomain: string

        return Promise.resolve()
            .then(function() {
                return self.getHasRootSsl()
            })
            .then(function(val: boolean) {
                hasRootSsl = val

                return self.getRootDomain()
            })
            .then(function(val) {
                rootDomain = val
            })
            .then(function() {
                return self.getDefaultAppNginxConfig()
            })
            .then(function(defaultAppNginxConfig) {
                return self
                    .getAppsDataStore()
                    .getAppsServerConfig(
                        defaultAppNginxConfig,
                        hasRootSsl,
                        rootDomain
                    )
            })
    }

    getAppsDataStore() {
        return this.appsDataStore
    }

    getRegistriesDataStore() {
        return this.registriesDataStore
    }

    setUserEmailAddress(emailAddress: string) {
        const self = this

        return new Promise<void>(function(resolve, reject) {
            self.data.set(EMAIL_ADDRESS, emailAddress)
            resolve()
        })
    }

    getUserEmailAddress() {
        const self = this

        return new Promise<string | undefined>(function(resolve, reject) {
            resolve(self.data.get(EMAIL_ADDRESS))
        })
    }

    setHasRootSsl(hasRootSsl: boolean) {
        const self = this

        return new Promise<void>(function(resolve, reject) {
            self.data.set(HAS_ROOT_SSL, hasRootSsl)
            resolve()
        })
    }

    setForceSsl(forceSsl: boolean) {
        const self = this

        return new Promise<void>(function(resolve, reject) {
            self.data.set(FORCE_ROOT_SSL, forceSsl)
            resolve()
        })
    }

    getForceSsl() {
        const self = this

        return new Promise<boolean>(function(resolve, reject) {
            resolve(self.data.get(FORCE_ROOT_SSL))
        })
    }

    setHasRegistrySsl(hasRegistrySsl: boolean) {
        const self = this

        return new Promise<void>(function(resolve, reject) {
            self.data.set(HAS_REGISTRY_SSL, hasRegistrySsl)
            resolve()
        })
    }

    getDefaultAppNginxConfig() {
        const self = this

        return Promise.resolve().then(function() {
            return DEFAULT_NGINX_CONFIG_FOR_APP
        })
    }

    getNginxConfig() {
        const self = this

        return Promise.resolve().then(function() {
            return {
                baseConfig: {
                    byDefault: DEFAULT_NGINX_BASE_CONFIG,
                    customValue: self.data.get(NGINX_BASE_CONFIG),
                },
                captainConfig: {
                    byDefault: DEFAULT_NGINX_CAPTAIN_CONFIG,
                    customValue: self.data.get(NGINX_CAPTAIN_CONFIG),
                },
            }
        })
    }

    setNginxConfig(baseConfig: string, captainConfig: string) {
        const self = this

        return Promise.resolve().then(function() {
            self.data.set(NGINX_BASE_CONFIG, baseConfig)
            self.data.set(NGINX_CAPTAIN_CONFIG, captainConfig)
        })
    }

    getHasRootSsl() {
        const self = this

        return new Promise<boolean>(function(resolve, reject) {
            resolve(self.data.get(HAS_ROOT_SSL))
        })
    }

    getHasRegistrySsl() {
        const self = this

        return new Promise<boolean>(function(resolve, reject) {
            resolve(!!self.data.get(HAS_REGISTRY_SSL))
        })
    }

    setCustomDomain(customDomain: string) {
        const self = this

        return new Promise<void>(function(resolve, reject) {
            self.data.set(CUSTOM_DOMAIN, customDomain)
            resolve()
        })
    }
}

export = DataStore
