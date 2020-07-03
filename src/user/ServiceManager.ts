import { ImageInfo } from 'dockerode'
import ApiStatusCodes from '../api/ApiStatusCodes'
import DataStore from '../datastore/DataStore'
import DockerApi, { IDockerUpdateOrders } from '../docker/DockerApi'
import CaptainConstants from '../utils/CaptainConstants'
import Logger from '../utils/Logger'
import Authenticator from './Authenticator'
import DockerRegistryHelper from './DockerRegistryHelper'
import ImageMaker, { BuildLogsManager } from './ImageMaker'
import DomainResolveChecker from './system/DomainResolveChecker'
import LoadBalancerManager from './system/LoadBalancerManager'
import requireFromString = require('require-from-string')

const serviceMangerCache = {} as IHashMapGeneric<ServiceManager>

interface QueuedPromise {
    resolve: undefined | ((reason?: unknown) => void)
    reject: undefined | ((reason?: any) => void)
    promise: undefined | Promise<unknown>
}

interface QueuedBuild {
    appName: string
    source: IImageSource
    promiseToSave: QueuedPromise
}

class ServiceManager {
    static get(
        namespace: string,
        authenticator: Authenticator,
        dataStore: DataStore,
        dockerApi: DockerApi,
        loadBalancerManager: LoadBalancerManager,
        domainResolveChecker: DomainResolveChecker
    ) {
        if (!serviceMangerCache[namespace]) {
            serviceMangerCache[namespace] = new ServiceManager(
                dataStore,
                authenticator,
                dockerApi,
                loadBalancerManager,
                domainResolveChecker
            )
        }
        return serviceMangerCache[namespace]
    }

    private activeOrScheduledBuilds: IHashMapGeneric<boolean>
    private buildLogsManager: BuildLogsManager
    private queuedBuilds: QueuedBuild[]
    private isReady: boolean
    private imageMaker: ImageMaker
    private dockerRegistryHelper: DockerRegistryHelper

    constructor(
        private dataStore: DataStore,
        private authenticator: Authenticator,
        private dockerApi: DockerApi,
        private loadBalancerManager: LoadBalancerManager,
        private domainResolveChecker: DomainResolveChecker
    ) {
        this.activeOrScheduledBuilds = {}
        this.queuedBuilds = []
        this.buildLogsManager = new BuildLogsManager()
        this.isReady = true
        this.dockerRegistryHelper = new DockerRegistryHelper(
            this.dataStore,
            this.dockerApi
        )
        this.imageMaker = new ImageMaker(
            this.dockerRegistryHelper,
            this.dockerApi,
            this.dataStore.getNameSpace(),
            this.buildLogsManager
        )
    }

    getRegistryHelper() {
        return this.dockerRegistryHelper
    }

    isInited() {
        return this.isReady
    }

    scheduleDeployNewVersion(appName: string, source: IImageSource) {
        const self = this

        let activeBuildAppName = self.isAnyBuildRunning()
        this.activeOrScheduledBuilds[appName] = true

        self.buildLogsManager.getAppBuildLogs(appName).clear()

        if (activeBuildAppName) {
            const existingBuildForTheSameApp = self.queuedBuilds.find(
                (v) => v.appName === appName
            )

            if (existingBuildForTheSameApp) {
                self.buildLogsManager
                    .getAppBuildLogs(appName)
                    .log(
                        `A build for ${appName} was queued, it's now being replaced with a new build...`
                    )

                // replacing the new source!
                existingBuildForTheSameApp.source = source

                const existingPromise =
                    existingBuildForTheSameApp.promiseToSave.promise

                if (!existingPromise)
                    throw new Error(
                        'Existing promise for the queued app is NULL!!'
                    )

                return existingPromise
            }

            self.buildLogsManager
                .getAppBuildLogs(appName)
                .log(
                    `An active build (${activeBuildAppName}) is in progress. This build is queued...`
                )

            let promiseToSave: QueuedPromise = {
                resolve: undefined,
                reject: undefined,
                promise: undefined,
            }

            let promise = new Promise(function (resolve, reject) {
                promiseToSave.resolve = resolve
                promiseToSave.reject = reject
            })

            promiseToSave.promise = promise

            self.queuedBuilds.push({ appName, source, promiseToSave })

            // This should only return when the build is finished,
            // somehow we need save the promise in queue - for "attached builds"
            return promise
        }

        return this.startDeployingNewVersion(appName, source)
    }

    startDeployingNewVersion(appName: string, source: IImageSource) {
        const self = this
        const dataStore = this.dataStore
        let deployedVersion: number

        return Promise.resolve() //
            .then(function () {
                return dataStore.getAppsDataStore().createNewVersion(appName)
            })
            .then(function (appVersion) {
                deployedVersion = appVersion
                return dataStore
                    .getAppsDataStore()
                    .getAppDefinition(appName)
                    .then(function (app) {
                        return self.imageMaker.ensureImage(
                            source,
                            appName,
                            app.captainDefinitionRelativeFilePath,
                            appVersion,
                            app.envVars
                        )
                    })
            })
            .then(function (builtImage) {
                return dataStore
                    .getAppsDataStore()
                    .setDeployedVersionAndImage(
                        appName,
                        deployedVersion,
                        builtImage
                    )
            })
            .then(function () {
                self.onBuildFinished(appName)
                return self.ensureServiceInitedAndUpdated(appName)
            })
            .catch(function (error) {
                self.onBuildFinished(appName)
                return new Promise<void>(function (resolve, reject) {
                    self.logBuildFailed(appName, error)
                    reject(error)
                })
            })
    }

    onBuildFinished(appName: string) {
        const self = this
        self.activeOrScheduledBuilds[appName] = false

        Promise.resolve().then(function () {
            let newBuild = self.queuedBuilds.shift()
            if (newBuild)
                self.startDeployingNewVersion(newBuild.appName, newBuild.source)
        })
    }

    enableCustomDomainSsl(appName: string, customDomain: string) {
        const self = this

        return Promise.resolve()
            .then(function () {
                Logger.d(`Verifying Captain owns domain: ${customDomain}`)

                return self.domainResolveChecker.verifyCaptainOwnsDomainOrThrow(
                    customDomain,
                    undefined
                )
            })
            .then(function () {
                Logger.d(`Enabling SSL for: ${appName} on ${customDomain}`)

                return self.dataStore
                    .getAppsDataStore()
                    .verifyCustomDomainBelongsToApp(appName, customDomain)
            })
            .then(function () {
                return self.domainResolveChecker.requestCertificateForDomain(
                    customDomain
                )
            })
            .then(function () {
                return self.dataStore
                    .getAppsDataStore()
                    .enableCustomDomainSsl(appName, customDomain)
            })
            .then(function () {
                return self.reloadLoadBalancer()
            })
    }

    addCustomDomain(appName: string, customDomain: string) {
        const self = this

        return Promise.resolve()
            .then(function () {
                const rootDomain = self.dataStore.getRootDomain()
                const dotRootDomain = `.${rootDomain}`

                if (!customDomain || !/^[a-z0-9\-\.]+$/.test(customDomain)) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'Domain name is not accepted. Please use alphanumerical domains such as myapp.google123.ca'
                    )
                }

                if (customDomain.length > 80) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'Domain name is not accepted. Please use alphanumerical domains less than 80 characters in length.'
                    )
                }

                if (customDomain.indexOf('..') >= 0) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'Domain name is not accepted. You cannot have two consecutive periods ".." inside a domain name. Please use alphanumerical domains such as myapp.google123.ca'
                    )
                }

                if (
                    customDomain.indexOf(dotRootDomain) >= 0 &&
                    customDomain.indexOf(dotRootDomain) +
                        dotRootDomain.length ===
                        customDomain.length
                ) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'Domain name is not accepted. Custom domain cannot be subdomain of root domain.'
                    )
                }
            })
            .then(function () {
                return self.domainResolveChecker.verifyDomainResolvesToDefaultServerOnHost(
                    customDomain
                )
            })
            .then(function () {
                Logger.d(`Enabling custom domain for: ${appName}`)

                return self.dataStore
                    .getAppsDataStore()
                    .addCustomDomainForApp(appName, customDomain)
            })
            .then(function () {
                return self.reloadLoadBalancer()
            })
    }

    removeCustomDomain(appName: string, customDomain: string) {
        const self = this

        return Promise.resolve()
            .then(function () {
                Logger.d(`Removing custom domain for: ${appName}`)

                return self.dataStore
                    .getAppsDataStore()
                    .removeCustomDomainForApp(appName, customDomain)
            })
            .then(function () {
                return self.reloadLoadBalancer()
            })
    }

    enableSslForApp(appName: string) {
        const self = this

        let rootDomain: string

        return Promise.resolve()
            .then(function () {
                return self.verifyCaptainOwnsGenericSubDomain(appName)
            })
            .then(function () {
                Logger.d(`Enabling SSL for: ${appName}`)

                return self.dataStore.getRootDomain()
            })
            .then(function (val) {
                rootDomain = val

                if (!rootDomain) {
                    throw new Error('No rootDomain! Cannot verify domain')
                }
            })
            .then(function () {
                // it will ensure that the app exists, otherwise it throws an exception
                return self.dataStore
                    .getAppsDataStore()
                    .getAppDefinition(appName)
            })
            .then(function () {
                return `${appName}.${rootDomain}`
            })
            .then(function (domainName) {
                return self.domainResolveChecker.requestCertificateForDomain(
                    domainName
                )
            })
            .then(function () {
                return self.dataStore
                    .getAppsDataStore()
                    .setSslForDefaultSubDomain(appName, true)
            })
            .then(function () {
                return self.reloadLoadBalancer()
            })
    }

    verifyCaptainOwnsGenericSubDomain(appName: string) {
        const self = this

        let rootDomain: string

        return Promise.resolve()
            .then(function () {
                return self.dataStore.getRootDomain()
            })
            .then(function (val) {
                rootDomain = val
            })
            .then(function () {
                // it will ensure that the app exists, otherwise it throws an exception
                return self.dataStore
                    .getAppsDataStore()
                    .getAppDefinition(appName)
            })
            .then(function () {
                return `${appName}.${rootDomain}`
            })
            .then(function (domainName) {
                Logger.d(`Verifying Captain owns domain: ${domainName}`)

                return self.domainResolveChecker.verifyCaptainOwnsDomainOrThrow(
                    domainName,
                    undefined
                )
            })
    }

    renameApp(oldAppName: string, newAppName: string) {
        Logger.d(`Renaming app: ${oldAppName}`)
        const self = this

        const oldServiceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(oldAppName)
        const dockerApi = this.dockerApi
        const dataStore = this.dataStore

        let defaultSslOn = false

        return Promise.resolve()
            .then(function () {
                return dataStore.getAppsDataStore().getAppDefinition(oldAppName)
            })
            .then(function (appDef) {
                defaultSslOn = !!appDef.hasDefaultSubDomainSsl

                dataStore.getAppsDataStore().nameAllowedOrThrow(newAppName)

                return self.ensureNotBuilding(oldAppName)
            })
            .then(function () {
                Logger.d(`Check if service is running: ${oldServiceName}`)
                return dockerApi.isServiceRunningByName(oldServiceName)
            })
            .then(function (isRunning) {
                if (!isRunning) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        'Service is not running!'
                    )
                }
                return dockerApi.removeServiceByName(oldServiceName)
            })
            .then(function () {
                return dataStore
                    .getAppsDataStore()
                    .renameApp(self.authenticator, oldAppName, newAppName)
            })
            .then(function () {
                return self.ensureServiceInitedAndUpdated(newAppName)
            })
            .then(function () {
                if (defaultSslOn) return self.enableSslForApp(newAppName)
            })
    }

    removeApp(appName: string) {
        Logger.d(`Removing service for: ${appName}`)
        const self = this

        const serviceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(appName)
        const dockerApi = this.dockerApi
        const dataStore = this.dataStore

        return Promise.resolve()
            .then(function () {
                return self.ensureNotBuilding(appName)
            })
            .then(function () {
                Logger.d(`Check if service is running: ${serviceName}`)
                return dockerApi.isServiceRunningByName(serviceName)
            })
            .then(function (isRunning) {
                if (isRunning) {
                    return dockerApi.removeServiceByName(serviceName)
                } else {
                    Logger.w(
                        `Cannot delete service... It is not running: ${serviceName}`
                    )
                    return true
                }
            })
            .then(function () {
                return dataStore.getAppsDataStore().deleteAppDefinition(appName)
            })
            .then(function () {
                return self.reloadLoadBalancer()
            })
    }

    removeVolsSafe(volumes: string[]) {
        const dockerApi = this.dockerApi
        const dataStore = this.dataStore

        const volsFailedToDelete: IHashMapGeneric<boolean> = {}

        return Promise.resolve()
            .then(function () {
                return dataStore.getAppsDataStore().getAppDefinitions()
            })
            .then(function (apps) {
                // Don't even try deleting volumes which are present in other app definitions
                Object.keys(apps).forEach((appName) => {
                    const app = apps[appName]
                    const volsInApp = app.volumes || []

                    volsInApp.forEach((v) => {
                        const volName = v.volumeName
                        if (!volName) return
                        if (volumes.indexOf(volName) >= 0) {
                            volsFailedToDelete[volName] = true
                        }
                    })
                })

                const volumesTryToDelete: string[] = []

                volumes.forEach((v) => {
                    if (!volsFailedToDelete[v]) {
                        volumesTryToDelete.push(
                            dataStore.getAppsDataStore().getVolumeName(v)
                        )
                    }
                })

                return dockerApi.deleteVols(volumesTryToDelete)
            })
            .then(function (failedVols) {
                failedVols.forEach((v) => {
                    volsFailedToDelete[v] = true
                })

                return Object.keys(volsFailedToDelete)
            })
    }

    getUnusedImages(mostRecentLimit: number) {
        Logger.d(
            `Getting unused images, excluding most recent ones: ${mostRecentLimit}`
        )

        const dockerApi = this.dockerApi
        const dataStore = this.dataStore
        let allImages: ImageInfo[]

        return Promise.resolve()
            .then(function () {
                return dockerApi.getImages()
            })
            .then(function (images) {
                allImages = images

                return dataStore.getAppsDataStore().getAppDefinitions()
            })
            .then(function (apps) {
                const unusedImages = []

                if (mostRecentLimit < 0) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'Most Recent Limit cannot be negative'
                    )
                }

                for (let i = 0; i < allImages.length; i++) {
                    const currentImage = allImages[i]
                    let imageInUse = false

                    const repoTags = currentImage.RepoTags || []

                    Object.keys(apps).forEach(function (appName) {
                        const app = apps[appName]
                        for (let k = 0; k < mostRecentLimit + 1; k++) {
                            const versionToCheck =
                                Number(app.deployedVersion) - k

                            if (versionToCheck < 0) continue

                            let deployedImage = ''
                            app.versions.forEach((v) => {
                                if (v.version === versionToCheck) {
                                    deployedImage = v.deployedImageName || ''
                                }
                            })

                            if (!deployedImage) continue

                            if (repoTags.indexOf(deployedImage) >= 0) {
                                imageInUse = true
                            }
                        }
                    })

                    if (!imageInUse) {
                        unusedImages.push({
                            id: currentImage.Id,
                            tags: repoTags,
                        })
                    }
                }

                return unusedImages
            })
    }

    deleteImages(imageIds: string[]) {
        Logger.d('Deleting images...')

        const dockerApi = this.dockerApi

        return Promise.resolve().then(function () {
            return dockerApi.deleteImages(imageIds)
        })
    }

    createPreDeployFunctionIfExist(app: IAppDef): Function | undefined {
        let preDeployFunction = app.preDeployFunction

        if (!preDeployFunction) {
            return undefined
        }

        /*
        ////////////////////////////////// Expected content of the file //////////////////////////

            console.log('-------------------------------'+new Date());

            preDeployFunction = function (captainAppObj, dockerUpdateObject) {
                return Promise.resolve()
                        .then(function(){
                            console.log(JSON.stringify(dockerUpdateObject));
                            return dockerUpdateObject;
                        });
            };
         */

        preDeployFunction =
            preDeployFunction + '\n\n module.exports = preDeployFunction'

        return requireFromString(preDeployFunction)
    }

    ensureNotBuilding(appName: string) {
        if (this.activeOrScheduledBuilds[appName])
            throw ApiStatusCodes.createError(
                ApiStatusCodes.ILLEGAL_OPERATION,
                `Build in-progress for ${appName}. Please wait...`
            )
    }

    updateAppDefinition(
        appName: string,
        description: string,
        instanceCount: number,
        captainDefinitionRelativeFilePath: string,
        envVars: IAppEnvVar[],
        volumes: IAppVolume[],
        nodeId: string,
        notExposeAsWebApp: boolean,
        containerHttpPort: number,
        httpAuth: IHttpAuth,
        forceSsl: boolean,
        ports: IAppPort[],
        repoInfo: RepoInfo,
        customNginxConfig: string,
        preDeployFunction: string,
        websocketSupport: boolean
    ) {
        const self = this
        const dataStore = this.dataStore
        const dockerApi = this.dockerApi

        let serviceName: string

        const checkIfNodeIdExists = function (nodeIdToCheck: string) {
            return dockerApi.getNodesInfo().then(function (nodeInfo) {
                for (let i = 0; i < nodeInfo.length; i++) {
                    if (nodeIdToCheck === nodeInfo[i].nodeId) {
                        return
                    }
                }

                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    `Node ID you requested is not part of the swarm cluster: ${nodeIdToCheck}`
                )
            })
        }

        return Promise.resolve()
            .then(function () {
                return self.ensureNotBuilding(appName)
            })
            .then(function () {
                return dataStore.getAppsDataStore().getAppDefinition(appName)
            })
            .then(function (app) {
                serviceName = dataStore
                    .getAppsDataStore()
                    .getServiceName(appName)

                // After leaving this block, nodeId will be guaranteed to be NonNull
                if (app.hasPersistentData) {
                    if (nodeId) {
                        return checkIfNodeIdExists(nodeId)
                    } else {
                        if (app.nodeId) {
                            nodeId = app.nodeId
                        } else {
                            return dockerApi
                                .isServiceRunningByName(serviceName)
                                .then(function (isRunning: boolean) {
                                    if (!isRunning) {
                                        throw ApiStatusCodes.createError(
                                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                                            'Cannot find the service. Try again in a minute...'
                                        )
                                    }
                                    return dockerApi.getNodeIdByServiceName(
                                        serviceName,
                                        0
                                    )
                                })
                                .then(function (nodeIdRunningService: string) {
                                    if (!nodeIdRunningService) {
                                        throw ApiStatusCodes.createError(
                                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                                            'No NodeId was found. Try again in a minute...'
                                        )
                                    }

                                    nodeId = nodeIdRunningService
                                })
                        }
                    }
                } else {
                    if (volumes && volumes.length) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.ILLEGAL_OPERATION,
                            'Cannot set volumes for a non-persistent container!'
                        )
                    }

                    if (nodeId) {
                        return checkIfNodeIdExists(nodeId)
                    }
                }
            })
            .then(function () {
                return dataStore
                    .getAppsDataStore()
                    .updateAppDefinitionInDb(
                        appName,
                        description,
                        instanceCount,
                        captainDefinitionRelativeFilePath,
                        envVars,
                        volumes,
                        nodeId,
                        notExposeAsWebApp,
                        containerHttpPort,
                        httpAuth,
                        forceSsl,
                        ports,
                        repoInfo,
                        self.authenticator,
                        customNginxConfig,
                        preDeployFunction,
                        websocketSupport
                    )
            })
            .then(function () {
                return self.ensureServiceInitedAndUpdated(appName)
            })
            .then(function () {
                return self.reloadLoadBalancer()
            })
    }

    isAppBuilding(appName: string) {
        return !!this.activeOrScheduledBuilds[appName]
    }

    /**
     *
     * @returns the active build that it finds
     */
    isAnyBuildRunning() {
        const activeBuilds = this.activeOrScheduledBuilds

        for (const appName in activeBuilds) {
            if (!!activeBuilds[appName]) {
                return appName
            }
        }

        return undefined
    }

    getBuildStatus(appName: string) {
        const self = this

        return {
            isAppBuilding: self.isAppBuilding(appName),
            logs: self.buildLogsManager.getAppBuildLogs(appName).getLogs(),
            isBuildFailed: self.buildLogsManager.getAppBuildLogs(appName)
                .isBuildFailed,
        }
    }

    logBuildFailed(appName: string, error: string) {
        error = (error || '') + ''
        this.buildLogsManager.getAppBuildLogs(appName).onBuildFailed(error)
    }

    getAppLogs(appName: string, encoding: string) {
        const serviceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(appName)

        const dockerApi = this.dockerApi

        return Promise.resolve() //
            .then(function () {
                return dockerApi.getLogForService(
                    serviceName,
                    CaptainConstants.configs.appLogSize,
                    encoding
                )
            })
    }

    ensureServiceInitedAndUpdated(appName: string) {
        Logger.d(`Ensure service inited and Updated for: ${appName}`)
        const self = this

        const serviceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(appName)

        let imageName: string | undefined
        const dockerApi = this.dockerApi
        const dataStore = this.dataStore
        let app: IAppDef
        let dockerAuthObject: DockerAuthObj | undefined

        return Promise.resolve() //
            .then(function () {
                return dataStore.getAppsDataStore().getAppDefinition(appName)
            })
            .then(function (appFound) {
                app = appFound

                Logger.d(`Check if service is running: ${serviceName}`)
                return dockerApi.isServiceRunningByName(serviceName)
            })
            .then(function (isRunning) {
                for (let i = 0; i < app.versions.length; i++) {
                    const element = app.versions[i]
                    if (element.version === app.deployedVersion) {
                        imageName = element.deployedImageName
                        break
                    }
                }

                if (!imageName) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'ImageName for deployed version is not available, this version was probably failed due to an unsuccessful build!'
                    )
                }

                if (isRunning) {
                    Logger.d(`Service is already running: ${serviceName}`)
                    return true
                } else {
                    Logger.d(
                        `Creating service ${serviceName} with default image, we will update image later`
                    )

                    // if we pass in networks here. Almost always it results in a delayed update which causes
                    // update errors if they happen right away!
                    return dockerApi.createServiceOnNodeId(
                        CaptainConstants.configs.appPlaceholderImageName,
                        serviceName,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined
                    )
                }
            })
            .then(function () {
                return self.dockerRegistryHelper.getDockerAuthObjectForImageName(
                    imageName!
                )
            })
            .then(function (data) {
                dockerAuthObject = data
            })
            .then(function () {
                return self.createPreDeployFunctionIfExist(app)
            })
            .then(function (preDeployFunction) {
                Logger.d(
                    `Updating service ${serviceName} with image ${imageName}`
                )

                return dockerApi.updateService(
                    serviceName,
                    imageName,
                    app.volumes,
                    app.networks,
                    app.envVars,
                    undefined,
                    dockerAuthObject,
                    Number(app.instanceCount),
                    app.nodeId,
                    dataStore.getNameSpace(),
                    app.ports,
                    app,
                    IDockerUpdateOrders.AUTO,
                    preDeployFunction
                )
            })
            .then(function () {
                return new Promise<void>(function (resolve) {
                    // Waiting 2 extra seconds for docker DNS to pickup the service name
                    setTimeout(resolve, 2000)
                })
            })
            .then(function () {
                return self.reloadLoadBalancer()
            })
    }

    reloadLoadBalancer() {
        Logger.d('Updating Load Balancer - ServiceManager')
        const self = this
        return self.loadBalancerManager.rePopulateNginxConfigFile(
            self.dataStore
        )
    }
}

export default ServiceManager
