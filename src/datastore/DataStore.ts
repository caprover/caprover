/**
 * Created by kasra on 27/06/17.
 */
import Configstore = require('configstore')
import fs = require('fs-extra')
import { IAppDefSaved } from '../models/AppDefinition'
import {
    AutomatedCleanupConfigsCleaner,
    IAutomatedCleanupConfigs,
} from '../models/AutomatedCleanupConfigs'
import CapRoverTheme from '../models/CapRoverTheme'
import { GoAccessInfo } from '../models/GoAccessInfo'
import { NetDataInfo } from '../models/NetDataInfo'
import CaptainConstants from '../utils/CaptainConstants'
import CaptainEncryptor from '../utils/Encryptor'
import Utils from '../utils/Utils'
import AppsDataStore from './AppsDataStore'
import ProDataStore from './ProDataStore'
import ProjectsDataStore from './ProjectsDataStore'
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
const GOACCESS_INFO = 'goAccessInfo'
const NGINX_BASE_CONFIG = 'nginxBaseConfig'
const NGINX_CAPTAIN_CONFIG = 'nginxCaptainConfig'
const CUSTOM_ONE_CLICK_APP_URLS = 'oneClickAppUrls'
const FEATURE_FLAGS = 'featureFlags'
const AUTOMATED_CLEANUP = 'automatedCleanup'
const THEMES = 'themes'
const CURRENT_THEME = 'currentTheme'

const DEFAULT_CAPTAIN_ROOT_DOMAIN = 'captain.localhost'

const DEFAULT_NGINX_BASE_CONFIG = fs
    .readFileSync(__dirname + '/../../template/base-nginx-conf.ejs')
    .toString()
const DEFAULT_NGINX_CAPTAIN_CONFIG = fs
    .readFileSync(__dirname + '/../../template/root-nginx-conf.ejs')
    .toString()

let DEFAULT_NGINX_CONFIG_FOR_APP_PATH =
    __dirname + '/../../template/server-block-conf.ejs'

const SERVER_BLOCK_CONF_OVERRIDE_PATH =
    CaptainConstants.captainDataDirectory + '/server-block-conf-override.ejs'

if (fs.pathExistsSync(SERVER_BLOCK_CONF_OVERRIDE_PATH)) {
    DEFAULT_NGINX_CONFIG_FOR_APP_PATH = SERVER_BLOCK_CONF_OVERRIDE_PATH
}

const DEFAULT_NGINX_CONFIG_FOR_APP = fs
    .readFileSync(DEFAULT_NGINX_CONFIG_FOR_APP_PATH)
    .toString()

class DataStore {
    private encryptor: CaptainEncryptor
    private namespace: string
    private data: Configstore
    private appsDataStore: AppsDataStore
    private registriesDataStore: RegistriesDataStore
    proDataStore: ProDataStore
    private projectsDataStore: ProjectsDataStore

    constructor(namespace: string) {
        const data = new Configstore(
            `captain-store-${namespace}`, // This value seems to be unused
            {},
            {
                configPath: `${CaptainConstants.captainDataDirectory}/config-${namespace}.json`,
            }
        )

        // running migrations
        if (data.get('schemaVersion') < 2) {
            const appDefinitions = data.get('appDefinitions')
            if (appDefinitions) {
                Object.keys(appDefinitions).forEach((appName) => {
                    const appDef = appDefinitions[appName] as IAppDefSaved
                    appDef.isLegacyAppName = true
                })
            }

            data.set('appDefinitions', appDefinitions)
            data.set('schemaVersion', 2)
        }

        this.data = data
        this.namespace = namespace
        this.data.set(NAMESPACE, namespace)
        this.appsDataStore = new AppsDataStore(this.data, namespace)
        this.projectsDataStore = new ProjectsDataStore(
            this.data,
            this.appsDataStore
        )
        this.proDataStore = new ProDataStore(this.data)
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

    getFeatureFlags(): any {
        const self = this
        return self.data.get(FEATURE_FLAGS)
    }

    setFeatureFlags(featureFlags: any) {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.set(FEATURE_FLAGS, featureFlags)
        })
    }

    getThemes(): Promise<CapRoverTheme[]> {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.get(THEMES) || []
        })
    }

    deleteTheme(themeName: string) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.getThemes()
            })
            .then(function (themesFetched) {
                self.data.set(
                    THEMES,
                    Utils.copyObject(themesFetched).filter(
                        (it) => it.name !== themeName
                    )
                )
            })
    }

    saveThemes(themes: CapRoverTheme[]) {
        const self = this
        return Promise.resolve().then(function () {
            self.data.set(
                THEMES,
                (themes || []).filter((it) => !it.builtIn)
            )
        })
    }

    setCurrentTheme(themeName: string | undefined) {
        const self = this
        return Promise.resolve() //
            .then(function () {
                return self.data.set(CURRENT_THEME, themeName || '')
            })
    }

    getCurrentThemeName(): Promise<string | undefined> {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.get(CURRENT_THEME)
        })
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

    setDiskCleanupConfigs(configs: IAutomatedCleanupConfigs) {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.set(
                AUTOMATED_CLEANUP,
                AutomatedCleanupConfigsCleaner.sanitizeInput(configs)
            )
        })
    }

    getDiskCleanupConfigs(): Promise<IAutomatedCleanupConfigs> {
        const self = this
        return Promise.resolve().then(function () {
            return (
                self.data.get(AUTOMATED_CLEANUP) ||
                AutomatedCleanupConfigsCleaner.sanitizeInput({
                    mostRecentLimit: 0,
                    cronSchedule: '',
                    timezone: '',
                })
            )
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

    getGoAccessInfo() {
        const self = this
        const goAccessInfo = (self.data.get(GOACCESS_INFO) ||
            {}) as GoAccessInfo
        goAccessInfo.isEnabled = goAccessInfo.isEnabled || false
        if (!goAccessInfo.data || !goAccessInfo.isEnabled) {
            goAccessInfo.data = {
                rotationFrequencyCron: '0 0 1 * *', // monthly
                logRetentionDays: 180,
            }
        }
        return Promise.resolve(goAccessInfo)
    }

    setGoAccessInfo(goAccessInfo: GoAccessInfo) {
        const self = this
        return Promise.resolve().then(function () {
            return self.data.set(GOACCESS_INFO, goAccessInfo)
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

    getProjectsDataStore() {
        return this.projectsDataStore
    }

    getProDataStore() {
        return this.proDataStore
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

            return parsedArray
        })
    }

    insertOneClickBaseUrl(url: string) {
        const self = this

        return new Promise<void>(function (resolve, reject) {
            const parsedArray = JSON.parse(
                self.data.get(CUSTOM_ONE_CLICK_APP_URLS) || '[]'
            ) as string[]

            parsedArray.push(url)
            self.data.set(
                CUSTOM_ONE_CLICK_APP_URLS,
                JSON.stringify(parsedArray)
            )
            resolve()
        })
    }

    deleteOneClickBaseUrl(url: string) {
        const self = this

        return new Promise<void>(function (resolve, reject) {
            const parsedArray = JSON.parse(
                self.data.get(CUSTOM_ONE_CLICK_APP_URLS) || '[]'
            ) as string[]

            self.data.set(
                CUSTOM_ONE_CLICK_APP_URLS,
                JSON.stringify(parsedArray.filter((it) => it !== url))
            )
            resolve()
        })
    }
}

export default DataStore
