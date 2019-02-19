import uuid = require('uuid/v4')
import Validator = require('validator')
import SshClientImport = require('ssh2')
import request = require('request')
import CaptainConstants = require('../../utils/CaptainConstants')
import Logger = require('../../utils/Logger')
import LoadBalancerManager = require('./LoadBalancerManager')
import EnvVars = require('../../utils/EnvVars')
import CertbotManager = require('./CertbotManager')
import SelfHostedDockerRegistry = require('./SelfHostedDockerRegistry')
import ApiStatusCodes = require('../../api/ApiStatusCodes')
import DataStoreProvider = require('../../datastore/DataStoreProvider')
import DataStore = require('../../datastore/DataStore')
import DockerApi from '../../docker/DockerApi'
import { IRegistryTypes, IRegistryInfo } from '../../models/IRegistryInfo'
import MigrateCaptainDuckDuck from '../../utils/MigrateCaptainDuckDuck'
import Authenticator = require('../Authenticator')
import * as tar from 'tar'
import * as fs from 'fs-extra'
import Utils from '../../utils/Utils'
import { BackupMeta, RestoringInfo } from '../../models/BackupMeta'
const SshClient = SshClientImport.Client

const CURRENT_NODE_DONT_CHANGE = 'CURRENT_NODE_DONT_CHANGE'

const BACKUP_JSON = 'backup.json'
const RESTORE_INSTRUCTIONS = 'restore-instructions.json'

const RESTORE_JSON_ABS_PATH =
    CaptainConstants.restoreDirectoryPath + '/' + RESTORE_INSTRUCTIONS

export interface IBackupCallbacks {
    getNodesInfo: () => Promise<ServerDockerInfo[]>
    getCaptainSalt: () => string
    getCertbotManager: () => CertbotManager
}

export default class BackupManager {
    private longOperationInProgress: boolean

    constructor() {
        //
    }

    lock() {
        if (this.longOperationInProgress) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Another operation is in process for Certbot. Please wait a few seconds and try again.'
            )
        }

        this.longOperationInProgress = true
    }

    unlock() {
        this.longOperationInProgress = false
    }

    isRunning() {
        return !!this.longOperationInProgress
    }

    checkAndPrepareRestoration() {
        const self = this
        return Promise.resolve() //
            .then(function() {
                return self.extractBackupContentIfExists()
            })
            .then(function() {
                return self.prepareRestorationIfDirectoryExists()
            })
            .then(function() {
                // At this point, either:
                // 1) /captain/restore/restore-instructions.json exists
                // 2) Or, /captain/restore does not exist

                if (fs.pathExistsSync(RESTORE_JSON_ABS_PATH)) {
                    return self.processRestoreInstructions(
                        fs.readJsonSync(RESTORE_JSON_ABS_PATH)
                    )
                }
            })
    }

    processRestoreInstructions(restoringInfo: RestoringInfo) {
        const self = this

        if (!restoringInfo.nodesMapping.length)
            throw new Error(
                'Node Mapping is empty in restoring instructions file!'
            )

        if (
            restoringInfo.nodesMapping.length !==
            restoringInfo.oldNodesForReference.length
        ) {
            throw new Error(
                'Node Mapping has a different size than the old nodes in restoring instructions file!'
            )
        }

        let currentNodeFound = false

        restoringInfo.nodesMapping.forEach(n => {
            if (n.newIp === CURRENT_NODE_DONT_CHANGE) {
                currentNodeFound = true
            }
        })

        if (!currentNodeFound)
            throw new Error(
                'You are not supposed to change ' + CURRENT_NODE_DONT_CHANGE
            )

        const connectingFuncs: (() => Promise<void>)[] = []

        const newIps: string[] = []

        restoringInfo.nodesMapping.forEach(n => {
            if (
                !/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
                    n.oldIp
                )
            ) {
                throw new Error(`${n.oldIp} is not a valid IP`)
            }

            if (n.newIp === CURRENT_NODE_DONT_CHANGE) return

            if (!!n.newIp) {
                if (
                    !/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
                        n.newIp
                    )
                ) {
                    throw new Error(`${n.newIp} is not a valid IP`)
                }

                if (newIps.indexOf(n.newIp) >= 0) {
                    throw new Error(`${n.newIp} is repeated!!`)
                }

                newIps.push(n.newIp)

                connectingFuncs.push(function() {
                    return self.checkSshRoot(n.newIp, n.user, n.privateKeyPath)
                })
            }
        })

        return self.runPromises(connectingFuncs, 0)
    }

    runPromises(
        promises: (() => Promise<void>)[],
        curr: number
    ): Promise<void> {
        const self = this
        if (promises.length > curr) {
            return promises[curr]().then(function() {
                return self.runPromises(promises, curr + 1)
            })
        }

        return Promise.resolve()
    }

    checkSshRoot(
        remoteNodeIpAddress: string,
        user: string,
        privateKeyPath: string
    ) {
        return Promise.resolve() //
            .then(function() {
                if (!remoteNodeIpAddress) throw new Error('ip cannot be empty')

                if (!user) throw new Error('user cannot be empty')

                if (!privateKeyPath)
                    throw new Error('privateKeyPath cannot be empty')

                if (!fs.pathExistsSync(privateKeyPath))
                    throw new Error(
                        'private key is not found at ' + privateKeyPath
                    )

                return fs.readFile(privateKeyPath, 'utf8')
            })
            .then(function(privateKey) {
                return new Promise<string>(function(resolve, reject) {
                    const conn = new SshClient()
                    conn.on('error', function(err) {
                        Logger.e(err)
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                'SSH Connection error!!'
                            )
                        )
                    })
                        .on('ready', function() {
                            Logger.d('SSH Client :: ready')
                            conn.exec('docker info', function(err, stream) {
                                if (err) {
                                    Logger.e(err)
                                    reject(
                                        ApiStatusCodes.createError(
                                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                                            'SSH Running command failed!!'
                                        )
                                    )
                                    return
                                }

                                const dataReceived: string[] = []

                                let hasExisted = false

                                stream
                                    .on('close', function(
                                        code: string,
                                        signal: string
                                    ) {
                                        Logger.d(
                                            'Stream :: close :: code: ' +
                                                code +
                                                ', signal: ' +
                                                signal
                                        )
                                        conn.end()
                                        if (hasExisted) {
                                            return
                                        }
                                        hasExisted = true
                                        resolve(dataReceived.join(''))
                                    })
                                    .on('data', function(data: string) {
                                        Logger.d('STDOUT: ' + data)
                                        dataReceived.push(data)
                                    })
                                    .stderr.on('data', function(data) {
                                        Logger.e('STDERR: ' + data)
                                        if (hasExisted) {
                                            return
                                        }
                                        hasExisted = true
                                        reject(
                                            ApiStatusCodes.createError(
                                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                                'Error during setup: ' + data
                                            )
                                        )
                                    })
                            })
                        })
                        .connect({
                            host: remoteNodeIpAddress,
                            port: 22,
                            username: user,
                            privateKey: privateKey,
                        })
                })
            })
            .then(function(data) {
                if (data.toUpperCase().indexOf('SWARM: INACTIVE') < 0) {
                    throw new Error(
                        'Either not root or already part of swarm? The output must include "Swarm: inactive" from ' +
                            remoteNodeIpAddress
                    )
                }
            })
    }

    /**
     * By the time this method finishes, the instructions will be ready at
     *
     * /captain/restore/restore-instructions.json
     *
     * This method is graceful, if /captain/restore/ does not exist, it will early out gracefully
     */
    private prepareRestorationIfDirectoryExists() {
        const self = this
        return Promise.resolve() //
            .then(function() {
                const dirPath = CaptainConstants.restoreDirectoryPath

                if (!fs.pathExistsSync(dirPath)) return

                if (!fs.statSync(dirPath).isDirectory())
                    throw new Error('restore directory is not a directory!!')

                if (!fs.pathExistsSync(RESTORE_JSON_ABS_PATH)) {
                    return Promise.resolve() //
                        .then(function() {
                            const metaData = fs.readJsonSync(
                                CaptainConstants.restoreDirectoryPath +
                                    '/meta/' +
                                    BACKUP_JSON
                            )

                            const configData = fs.readJsonSync(
                                CaptainConstants.restoreDirectoryPath +
                                    '/data/config-captain.json'
                            )

                            return fs.outputJson(
                                RESTORE_JSON_ABS_PATH,
                                self.createRestoreInstructionData(
                                    metaData,
                                    configData
                                )
                            )
                        })
                }

                if (!fs.statSync(RESTORE_JSON_ABS_PATH).isFile())
                    throw new Error('restore instructions is not a file!!')
            })
    }

    createRestoreInstructionData(
        metaContent: BackupMeta,
        configData: { appDefinitions: IHashMapGeneric<IAppDefSaved> }
    ) {
        const ret: RestoringInfo = {
            nodesMapping: [],
            oldNodesForReference: [],
        }

        const oldServers = metaContent.nodes

        oldServers.forEach(s => {
            if (s.isLeader) {
                ret.nodesMapping.push({
                    newIp: CURRENT_NODE_DONT_CHANGE,
                    oldIp: s.ip,
                    privateKeyPath: '',
                    user: '',
                })
            } else {
                ret.nodesMapping.push({
                    newIp: 'replace-me-with-new-ip-or-empty-see-docs',
                    oldIp: s.ip,
                    privateKeyPath:
                        CaptainConstants.captainBaseDirectory + '/id_rsa',
                    user: 'root',
                })
            }

            const apps: string[] = []

            Object.keys(configData.appDefinitions).forEach(appName => {
                if (configData.appDefinitions[appName].nodeId === s.nodeId) {
                    apps.push(appName)
                }
            })

            ret.oldNodesForReference.push({
                nodeData: s,
                appsLockOnThisNode: apps,
            })
        })

        return ret
    }

    private extractBackupContentIfExists() {
        if (!fs.pathExistsSync(CaptainConstants.restoreTarFilePath))
            return Promise.resolve(false)

        if (!fs.statSync(CaptainConstants.restoreTarFilePath).isFile())
            throw new Error('restore tar file is not a file!!')

        return Promise.resolve() //
            .then(function() {
                return fs.ensureDir(CaptainConstants.restoreDirectoryPath)
            })
            .then(function() {
                return tar
                    .extract({
                        file: CaptainConstants.restoreTarFilePath,
                        cwd: CaptainConstants.restoreDirectoryPath,
                    })
                    .then(function() {
                        return fs.remove(CaptainConstants.restoreTarFilePath)
                    })
                    .then(function() {
                        return Promise.resolve(true)
                    })
            })
    }

    createBackup(iBackupCallbacks: IBackupCallbacks) {
        const self = this
        const certbotManager = iBackupCallbacks.getCertbotManager()

        return Promise.resolve() //
            .then(function() {
                certbotManager.lock()
                return self
                    .createBackupInternal(iBackupCallbacks)
                    .then(function(data) {
                        certbotManager.unlock()
                        return data
                    })
                    .catch(function(err) {
                        certbotManager.unlock()
                        throw err
                    })
            })
    }

    private createBackupInternal(iBackupCallbacks: IBackupCallbacks) {
        const self = this
        return Promise.resolve() //
            .then(function() {
                self.lock()

                // Check if exist /captain/temp/backup, delete directory
                // Create directory /captain/temp/backup/raw
                // Copy /captain/data to .../backup/raw/data
                // Ensure .../backup/raw/meta/backup.json
                // Create tar file FROM: .../backup/raw/   TO: .../backup/backup.tar

                const RAW = CaptainConstants.captainRootDirectoryBackup + '/raw'

                return Promise.resolve() //
                    .then(function() {
                        return self.deleteBackupDirectoryIfExists()
                    })
                    .then(function() {
                        return fs.ensureDir(RAW)
                    })
                    .then(function() {
                        return fs.copy(
                            CaptainConstants.captainDataDirectory,
                            RAW + '/data',
                            { preserveTimestamps: true }
                        )
                    })
                    .then(function() {
                        return iBackupCallbacks.getNodesInfo()
                    })
                    .then(function(nodes) {
                        return self.saveMetaFile(RAW + '/meta/' + BACKUP_JSON, {
                            salt: iBackupCallbacks.getCaptainSalt(),
                            nodes: nodes,
                        })
                    })
                    .then(function() {
                        const tarFilePath =
                            CaptainConstants.captainRootDirectoryBackup +
                            '/backup.tar'
                        return tar
                            .c(
                                {
                                    file: tarFilePath,
                                    cwd: RAW,
                                },
                                ['./']
                            )
                            .then(function() {
                                return tarFilePath
                            })
                    })
                    .then(function(tarFilePath) {
                        self.unlock()
                        return tarFilePath
                    })
                    .catch(function(err) {
                        self.unlock()
                        throw err
                    })
            })
    }

    saveMetaFile(absPath: string, metaData: BackupMeta) {
        return fs.outputJson(absPath, metaData)
    }

    deleteBackupDirectoryIfExists() {
        return Promise.resolve() //
            .then(function() {
                if (
                    fs.existsSync(CaptainConstants.captainRootDirectoryBackup)
                ) {
                    return fs.remove(
                        CaptainConstants.captainRootDirectoryBackup
                    )
                }
            })
    }
}
