import uuid = require('uuid/v4')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import CaptainConstants = require('../utils/CaptainConstants')
import Logger = require('../utils/Logger')
import configstore = require('configstore')
import Authenticator = require('../user/Authenticator')
import { CaptainEncryptor } from '../utils/Encryptor'
import { IBuiltImage } from '../models/IBuiltImage'

const isValidPath = require('is-valid-path')

const APP_DEFINITIONS = 'appDefinitions'

function isNameAllowed(name: string) {
    const isNameFormattingOk =
        !!name &&
        name.length < 50 &&
        /^[a-z]/.test(name) &&
        /[a-z0-9]$/.test(name) &&
        /^[a-z0-9\-]+$/.test(name) &&
        name.indexOf('--') < 0
    return isNameFormattingOk && ['captain', 'registry'].indexOf(name) < 0
}

function isPortValid(portNumber: number) {
    return portNumber > 0 && portNumber < 65535
}

class AppsDataStore {
    private encryptor: CaptainEncryptor

    constructor(private data: configstore, private namepace: string) {}

    setEncryptor(encryptor: CaptainEncryptor) {
        this.encryptor = encryptor
    }

    private saveApp(appName: String, app: IAppDef) {
        const self = this
        let passwordToBeEncrypted = ''
        return Promise.resolve()
            .then(function() {
                if (!appName) {
                    throw new Error('App Name should not be empty')
                }

                let pushWebhook = app.appPushWebhook
                if (
                    pushWebhook &&
                    pushWebhook.pushWebhookToken &&
                    pushWebhook.tokenVersion &&
                    pushWebhook.repoInfo &&
                    pushWebhook.repoInfo.repo
                ) {
                    // we have required info
                    passwordToBeEncrypted = pushWebhook.repoInfo.password
                    pushWebhook.repoInfo.password = ''
                } else {
                    // some required data is missing. We drop the push data
                    pushWebhook = undefined
                }

                if (app.forceSsl) {
                    let hasAtLeastOneSslDomain = app.hasDefaultSubDomainSsl
                    const customDomainArray = app.customDomain
                    if (customDomainArray && customDomainArray.length > 0) {
                        for (
                            let idx = 0;
                            idx < customDomainArray.length;
                            idx++
                        ) {
                            if (customDomainArray[idx].hasSsl) {
                                hasAtLeastOneSslDomain = true
                            }
                        }
                    }

                    if (!hasAtLeastOneSslDomain) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.ILLEGAL_OPERATION,
                            'Cannot force SSL without at least one SSL-enabled domain!'
                        )
                    }
                }

                if (app.ports) {
                    for (let i = 0; i < app.ports.length; i++) {
                        const obj = app.ports[i]
                        if (obj.containerPort && obj.hostPort) {
                            const containerPort = Number(obj.containerPort)
                            const hostPort = Number(obj.hostPort)

                            if (
                                !isPortValid(containerPort) ||
                                !isPortValid(hostPort)
                            ) {
                                throw new Error(
                                    `Invalid ports: ${hostPort} or ${containerPort}`
                                )
                            }
                        } else {
                            throw new Error('Host or container port is missing')
                        }
                    }
                }

                if (app.volumes) {
                    for (let i = 0; i < app.volumes.length; i++) {
                        const obj = app.volumes[i]
                        if (
                            !obj.containerPath ||
                            !(obj.volumeName || obj.hostPath)
                        ) {
                            throw new Error(
                                'containerPath or the source paths (volume name or host path) are missing'
                            )
                        }

                        if (obj.volumeName && obj.hostPath) {
                            throw ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                'Cannot define both host path and volume name!'
                            )
                        }

                        if (!isValidPath(obj.containerPath)) {
                            throw ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                'Invalid containerPath: ' + obj.containerPath
                            )
                        }

                        if (obj.hostPath && !isValidPath(obj.hostPath)) {
                            throw ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                'Invalid volume host path: ' + obj.hostPath
                            )
                        } else {
                            if (
                                !obj.volumeName ||
                                !isNameAllowed(obj.volumeName)
                            ) {
                                throw ApiStatusCodes.createError(
                                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                                    'Invalid volume name: ' + obj.volumeName
                                )
                            }
                        }
                    }
                }
            })
            .then(function() {
                const appToSave: IAppDefSaved = <IAppDefSaved>app
                if (passwordToBeEncrypted) {
                    appToSave.appPushWebhook!.repoInfo!.passwordEncrypted = self.encryptor.encrypt(
                        passwordToBeEncrypted
                    )
                }

                return appToSave
            })
            .then(function(appToSave: IAppDefSaved) {
                self.data.set(APP_DEFINITIONS + '.' + appName, appToSave)
            })
    }

    getServiceName(appName: string) {
        return 'srv-' + this.namepace + '--' + appName
    }

    getAppDefinitions() {
        const self = this
        return new Promise<IAllAppDefinitions>(function(resolve, reject) {
            let allApps = self.data.get(APP_DEFINITIONS) || {}
            let allAppsUnencrypted: IAllAppDefinitions = {}

            Object.keys(allApps).forEach(function(appName) {
                allAppsUnencrypted[appName] = allApps[appName]
                const appUnencrypted = allAppsUnencrypted[appName]

                const appSave = allApps[appName] as IAppDefSaved

                if (
                    appSave.appPushWebhook &&
                    appSave.appPushWebhook.repoInfo &&
                    appSave.appPushWebhook.repoInfo.passwordEncrypted
                ) {
                    const repo = appSave.appPushWebhook!.repoInfo
                    appUnencrypted!.appPushWebhook = {
                        tokenVersion: appSave.appPushWebhook.tokenVersion,
                        pushWebhookToken:
                            appSave.appPushWebhook.pushWebhookToken,
                        repoInfo: {
                            repo: repo.repo,
                            user: repo.user,
                            password: self.encryptor.decrypt(
                                repo.passwordEncrypted
                            ),
                            branch: repo.branch,
                        },
                    }
                }
            })
            resolve(allAppsUnencrypted)
        })
    }

    getAppDefinition(appName: string) {
        const self = this

        return this.getAppDefinitions().then(function(allApps) {
            if (!appName) {
                throw new Error('App Name should not be empty')
            }

            const app = allApps[appName]

            if (!app) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    `App (${appName}) could not be found. Make sure that you have created the app.`
                )
            }

            return app
        })
    }

    enableSslForDefaultSubDomain(appName: string) {
        const self = this

        return this.getAppDefinition(appName).then(function(app) {
            app.hasDefaultSubDomainSsl = true
            return self.saveApp(appName, app)
        })
    }

    enableCustomDomainSsl(appName: string, customDomain: string) {
        const self = this

        return self.getAppDefinition(appName).then(function(app) {
            app.customDomain = app.customDomain || []

            if (app.customDomain.length > 0) {
                for (let idx = 0; idx < app.customDomain.length; idx++) {
                    if (app.customDomain[idx].publicDomain === customDomain) {
                        app.customDomain[idx].hasSsl = true
                        return self.saveApp(appName, app)
                    }
                }
            }

            throw new Error(
                `customDomain: ${customDomain} is not attached to app ${appName}`
            )
        })
    }

    removeCustomDomainForApp(appName: string, customDomain: string) {
        const self = this

        return this.getAppDefinition(appName).then(function(app) {
            app.customDomain = app.customDomain || []

            const newDomains = []
            let removed = false
            for (let idx = 0; idx < app.customDomain.length; idx++) {
                if (app.customDomain[idx].publicDomain === customDomain) {
                    removed = true
                } else {
                    newDomains.push(app.customDomain[idx])
                }
            }

            if (!removed) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    `Custom domain ${customDomain} does not exist in ${appName}`
                )
            }

            app.customDomain = newDomains
            return self.saveApp(appName, app)
        })
    }

    addCustomDomainForApp(appName: string, customDomain: string) {
        const self = this

        return this.getAppDefinition(appName).then(function(app) {
            app.customDomain = app.customDomain || []

            if (app.customDomain.length > 0) {
                for (let idx = 0; idx < app.customDomain.length; idx++) {
                    if (app.customDomain[idx].publicDomain === customDomain) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.ILLEGAL_PARAMETER,
                            `App already has customDomain: ${customDomain} attached to app ${appName}`
                        )
                    }
                }
            }

            app.customDomain.push({
                publicDomain: customDomain,
                hasSsl: false,
            })

            return self.saveApp(appName, app)
        })
    }

    verifyCustomDomainBelongsToApp(appName: string, customDomain: string) {
        const self = this

        return self.getAppDefinition(appName).then(function(app) {
            app.customDomain = app.customDomain || []

            if (app.customDomain.length > 0) {
                for (let idx = 0; idx < app.customDomain.length; idx++) {
                    if (app.customDomain[idx].publicDomain === customDomain) {
                        return true
                    }
                }
            }

            throw ApiStatusCodes.createError(
                ApiStatusCodes.ILLEGAL_PARAMETER,
                `customDomain ${customDomain} is not attached to app ${appName}`
            )
        })
    }

    setDeployedVersionAndImage(
        appName: string,
        deployedVersion: number,
        builtImage: IBuiltImage
    ) {
        if (!appName) {
            throw new Error('App Name should not be empty')
        }

        if (!builtImage || !builtImage.imageName) {
            throw new Error('ImageName Name should not be empty')
        }

        const self = this

        return this.getAppDefinition(appName) //
            .then(function(app) {
                const versions = app.versions

                let found = false

                for (let i = 0; i < versions.length; i++) {
                    const element = versions[i]
                    if (element.version === deployedVersion) {
                        element.deployedImageName = builtImage.imageName
                        element.gitHash = builtImage.gitHash
                        found = true
                        break
                    }
                }

                if (!found) {
                    throw new Error(
                        `Version trying to deploy not found ${deployedVersion}`
                    )
                }

                app.deployedVersion = deployedVersion

                return self.saveApp(appName, app)
            })
    }

    createNewVersion(appName: string) {
        if (!appName) {
            throw new Error('App Name should not be empty')
        }
        const self = this

        return this.getAppDefinition(appName).then(function(app) {
            const versions = app.versions

            let newVersionIndex = versions.length

            // Just in case some versions from the db were deleted manually!!!
            for (let index = 0; index < versions.length; index++) {
                const element = versions[index]
                if (newVersionIndex < element.version) {
                    newVersionIndex = element.version + 1
                }
            }

            versions.push({
                version: newVersionIndex,
                gitHash: undefined,
                timeStamp: new Date().toString(),
            })

            return self.saveApp(appName, app).then(function() {
                return newVersionIndex
            })
        })
    }

    setVersionsForMigration(
        appName: string,
        vers: IAppVersion[],
        deployedVersion: number
    ) {
        const self = this
        return Promise.resolve() //
            .then(function() {
                return self.getAppDefinition(appName)
            })
            .then(function(appLoaded) {
                appLoaded.deployedVersion = deployedVersion
                appLoaded.versions = vers
                return self.saveApp(appName, appLoaded)
            })
    }

    updateAppDefinitionInDb(
        appName: string,
        instanceCount: number,
        envVars: IAppEnvVar[],
        volumes: IAppVolume[],
        nodeId: string,
        notExposeAsWebApp: boolean,
        forceSsl: boolean,
        ports: IAppPort[],
        repoInfo: RepoInfo,
        authenticator: Authenticator,
        customNginxConfig: string,
        preDeployFunction: string
    ) {
        const self = this
        let appObj: IAppDef

        return Promise.resolve()
            .then(function() {
                return self.getAppDefinition(appName)
            })
            .then(function(appLoaded) {
                appObj = appLoaded

                if (
                    repoInfo &&
                    repoInfo.repo &&
                    repoInfo.branch &&
                    repoInfo.user &&
                    repoInfo.password
                ) {
                    appObj.appPushWebhook = {
                        tokenVersion:
                            appObj.appPushWebhook &&
                            appObj.appPushWebhook.tokenVersion
                                ? appObj.appPushWebhook.tokenVersion
                                : uuid(),
                        pushWebhookToken: appObj.appPushWebhook
                            ? appObj.appPushWebhook.pushWebhookToken
                            : '',
                        repoInfo: {
                            repo: repoInfo.repo,
                            user: repoInfo.user,
                            branch: repoInfo.branch,
                            password: repoInfo.password,
                        },
                    }

                    if (appObj.appPushWebhook.pushWebhookToken) {
                        return Promise.resolve(undefined)
                    }

                    return authenticator
                        .getAppPushWebhookToken(
                            appName,
                            appObj.appPushWebhook.tokenVersion
                        )
                        .then(function(val) {
                            appObj.appPushWebhook!.pushWebhookToken = val
                        })
                } else {
                    appObj.appPushWebhook = undefined
                    return Promise.resolve(undefined)
                }
            })
            .then(function() {
                instanceCount = Number(instanceCount)

                if (instanceCount >= 0) {
                    appObj.instanceCount = instanceCount
                }

                appObj.notExposeAsWebApp = !!notExposeAsWebApp
                appObj.forceSsl = !!forceSsl
                appObj.nodeId = nodeId
                appObj.customNginxConfig = customNginxConfig
                appObj.preDeployFunction = preDeployFunction

                if (ports) {
                    appObj.ports = []
                    for (let i = 0; i < ports.length; i++) {
                        const obj = ports[i]
                        const containerPort = Number(obj.containerPort)
                        const hostPort = Number(obj.hostPort)
                        appObj.ports.push({
                            hostPort: hostPort,
                            containerPort: containerPort,
                        })
                    }
                }

                if (envVars) {
                    appObj.envVars = []
                    for (let i = 0; i < envVars.length; i++) {
                        const obj = envVars[i]
                        if (obj.key && obj.value) {
                            appObj.envVars.push({
                                key: obj.key,
                                value: obj.value,
                            })
                        }
                    }
                }

                if (volumes) {
                    appObj.volumes = []

                    for (let i = 0; i < volumes.length; i++) {
                        const obj = volumes[i]

                        const newVol = {
                            containerPath: obj.containerPath,
                        } as IAppVolume

                        if (obj.hostPath) {
                            newVol.hostPath = obj.hostPath
                        } else {
                            newVol.volumeName = obj.volumeName
                        }

                        appObj.volumes.push(newVol)
                    }
                }
            })
            .then(function() {
                return self.saveApp(appName, appObj)
            })
    }

    deleteAppDefinition(appName: string) {
        const self = this

        return new Promise<void>(function(resolve, reject) {
            if (!isNameAllowed(appName)) {
                reject(
                    ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'App Name is not allow. Only lowercase letters and single hyphen is allow'
                    )
                )
                return
            }

            if (!self.data.get(APP_DEFINITIONS + '.' + appName)) {
                reject(
                    ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        'App Name does not exist in Database! Cannot be deleted.'
                    )
                )
                return
            }

            self.data.delete(APP_DEFINITIONS + '.' + appName)
            resolve()
        })
    }

    /**
     * Creates a new app definition.
     *
     * @param appName                   The appName you want to register
     * @param hasPersistentData         whether the app has persistent data, you can only run one instance of the app.
     * @returns {Promise}
     */
    registerAppDefinition(appName: string, hasPersistentData: boolean) {
        const self = this

        return new Promise<IAppDef>(function(resolve, reject) {
            if (!isNameAllowed(appName)) {
                reject(
                    ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'App Name is not allow. Only lowercase letters and single hyphen is allow'
                    )
                )
                return
            }

            if (!!self.data.get(APP_DEFINITIONS + '.' + appName)) {
                reject(
                    ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_ALREADY_EXIST,
                        'App Name already exists. Please use a different name'
                    )
                )
                return
            }

            const defaultAppDefinition: IAppDef = {
                hasPersistentData: !!hasPersistentData,
                instanceCount: 1,
                networks: [CaptainConstants.captainNetworkName],
                envVars: [],
                volumes: [],
                ports: [],
                versions: [],
                deployedVersion: 0,
                notExposeAsWebApp: false,
                customDomain: [],
                hasDefaultSubDomainSsl: false,
                forceSsl: false,
            }

            resolve(defaultAppDefinition)
        }).then(function(app) {
            return self.saveApp(appName, app)
        })
    }

    getAppsServerConfig(
        defaultAppNginxConfig: string,
        hasRootSsl: boolean,
        rootDomain: string
    ) {
        const self = this

        const servers: IServerBlockDetails[] = []

        return self.getAppDefinitions().then(function(apps) {
            Object.keys(apps).forEach(function(appName) {
                const webApp = apps[appName]

                if (webApp.notExposeAsWebApp) {
                    return
                }

                const localDomain = self.getServiceName(appName)
                const forceSsl = !!webApp.forceSsl
                const nginxConfigTemplate =
                    webApp.customNginxConfig || defaultAppNginxConfig

                const serverWithSubDomain = {} as IServerBlockDetails
                serverWithSubDomain.hasSsl =
                    hasRootSsl && webApp.hasDefaultSubDomainSsl
                serverWithSubDomain.publicDomain = appName + '.' + rootDomain
                serverWithSubDomain.localDomain = localDomain
                serverWithSubDomain.forceSsl = forceSsl
                serverWithSubDomain.nginxConfigTemplate = nginxConfigTemplate

                servers.push(serverWithSubDomain)

                // adding custom domains
                const customDomainArray = webApp.customDomain
                if (customDomainArray && customDomainArray.length > 0) {
                    for (let idx = 0; idx < customDomainArray.length; idx++) {
                        const d = customDomainArray[idx]
                        servers.push({
                            hasSsl: d.hasSsl,
                            forceSsl: forceSsl,
                            publicDomain: d.publicDomain,
                            localDomain: localDomain,
                            nginxConfigTemplate: nginxConfigTemplate,
                            staticWebRoot: '',
                            customErrorPagesDirectory: '',
                        })
                    }
                }
            })

            return servers
        })
    }
}

export = AppsDataStore
