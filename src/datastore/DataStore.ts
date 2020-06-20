/**
 * Created by kasra on 27/06/17.
 */
import Configstore = require('configstore')
import fs = require('fs-extra')
import CaptainConstants from '../utils/CaptainConstants'
import CaptainEncryptor from '../utils/Encryptor'
import AppsDataStore from './AppsDataStore'
import RegistriesDataStore from './RegistriesDataStore'

// keys:
const NAMESPACE = 'namespace'
const HASHED_PASSWORD = 'hashedPassword'
const CUSTOM_DOMAIN = 'customDomain'
const HAS_ROOT_SSL = 'hasRootSsl'
const FORCE_ROOT_SSL = 'forceRootSsl'
const HAS_REGISTRY_SSL = 'hasRegistrySsl'
const EMAIL_ADDRESS = 'emailAddress'
const NET_DATA_INFO = 'netDataInfo'
const NGINX_BASE_CONFIG = 'nginxBaseConfig'
const NGINX_CAPTAIN_CONFIG = 'nginxCaptainConfig'
const CUSTOM_ONE_CLICK_APP_URLS = 'oneClickAppUrls'

const DEFAULT_CAPTAIN_ROOT_DOMAIN = 'captain.localhost'
const DEFAULT_ONE_CLICK_BASE_URL = 'https://oneclickapps.caprover.com'

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
    private encryptor: CaptainEncryptor
    private namespace: string
    private data: Configstore
    private appsDataStore: AppsDataStore
    private registriesDataStore: RegistriesDataStore

    constructor(namespace: string) {
        const data = new Configstore(
            `captain-store-${namespace}`, // This value seems to be unused
            {},
            {
                configPath: `${CaptainConstants.captainDataDirectory}/config-${namespace}.json`,
            }
        )

        this.data = data
        this.namespace = namespace
        this.data.set(NAMESPACE, namespace)
        this.appsDataStore = new AppsDataStore(this.data, namespace)
        this.registriesDataStore = new RegistriesDataStore(this.data, namespace)
    }

    setEncryptionSalt(salt: string) {
        this.encryptor = new CaptainEncryptor(this.namespace + salt)
        this.appsDataStore.setEncryptor(this.encryptor)
        this.registriesDataStore.setEncryptor(this.encryptor)
    }

    getNameSpace(): string {
        return this.data.get(NAMESPACE)
    }

    setHashedPassword(newHashedPassword: string) {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.set(HASHED_PASSWORD, newHashedPassword)
        })
    }

    getHashedPassword() {
        const self = this
        return Promise.resolve().then(function () {
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
        return Promise.resolve().then(function () {
            const netDataInfo = self.data.get(NET_DATA_INFO) || {}
            netDataInfo.isEnabled = netDataInfo.isEnabled || false
            netDataInfo.data = netDataInfo.data || {}
            netDataInfo.data.smtp =
                netDataInfo.data.smtp && netDataInfo.data.smtp.username
                    ? netDataInfo.data.smtp
                    : {}
            netDataInfo.data.slack = netDataInfo.data.slack || {}
            netDataInfo.data.telegram = netDataInfo.data.telegram || {}
            netDataInfo.data.pushBullet = netDataInfo.data.pushBullet || {}
            return netDataInfo
        })
    }

    setNetDataInfo(netDataInfo: NetDataInfo) {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.set(NET_DATA_INFO, netDataInfo)
        })
    }

    getRootDomain() {
        return this.data.get(CUSTOM_DOMAIN) || DEFAULT_CAPTAIN_ROOT_DOMAIN
    }

    hasCustomDomain() {
        return !!this.data.get(CUSTOM_DOMAIN)
    }

    getAppsDataStore() {
        return this.appsDataStore
    }

    getRegistriesDataStore() {
        return this.registriesDataStore
    }

    setUserEmailAddress(emailAddress: string) {
        const self = this

        return new Promise<void>(function (resolve, reject) {
            self.data.set(EMAIL_ADDRESS, emailAddress)
            resolve()
        })
    }

    getUserEmailAddress() {
        const self = this

        return new Promise<string | undefined>(function (resolve, reject) {
            resolve(self.data.get(EMAIL_ADDRESS))
        })
    }

    setHasRootSsl(hasRootSsl: boolean) {
        const self = this

        return new Promise<void>(function (resolve, reject) {
            self.data.set(HAS_ROOT_SSL, hasRootSsl)
            resolve()
        })
    }

    setForceSsl(forceSsl: boolean) {
        const self = this

        return new Promise<void>(function (resolve, reject) {
            self.data.set(FORCE_ROOT_SSL, forceSsl)
            resolve()
        })
    }

    getForceSsl() {
        const self = this

        return new Promise<boolean>(function (resolve, reject) {
            resolve(!!self.data.get(FORCE_ROOT_SSL))
        })
    }

    setHasRegistrySsl(hasRegistrySsl: boolean) {
        const self = this

        return new Promise<void>(function (resolve, reject) {
            self.data.set(HAS_REGISTRY_SSL, hasRegistrySsl)
            resolve()
        })
    }

    getDefaultAppNginxConfig() {
        const self = this

        return Promise.resolve().then(function () {
            return DEFAULT_NGINX_CONFIG_FOR_APP
        })
    }

    getNginxConfig() {
        const self = this

        return Promise.resolve().then(function () {
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

        return Promise.resolve().then(function () {
            self.data.set(NGINX_BASE_CONFIG, baseConfig)
            self.data.set(NGINX_CAPTAIN_CONFIG, captainConfig)
        })
    }

    getHasRootSsl() {
        const self = this

        return new Promise<boolean>(function (resolve, reject) {
            resolve(self.data.get(HAS_ROOT_SSL))
        })
    }

    getHasRegistrySsl() {
        const self = this

        return new Promise<boolean>(function (resolve, reject) {
            resolve(!!self.data.get(HAS_REGISTRY_SSL))
        })
    }

    setCustomDomain(customDomain: string) {
        const self = this

        return new Promise<void>(function (resolve, reject) {
            self.data.set(CUSTOM_DOMAIN, customDomain)
            resolve()
        })
    }

    getAllOneClickBaseUrls() {
        const self = this

        return new Promise<string>(function (resolve, reject) {
            resolve(self.data.get(CUSTOM_ONE_CLICK_APP_URLS))
        }).then(function (dataString) {
            const parsedArray = JSON.parse(dataString || '[]') as string[]
            parsedArray.push(DEFAULT_ONE_CLICK_BASE_URL)

            return parsedArray
        })
    }
}

export default DataStore
