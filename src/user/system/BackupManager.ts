import SshClientImport = require('ssh2')
import { exec } from 'child_process'
import * as fs from 'fs-extra'
import * as moment from 'moment'
import * as path from 'path'
import * as tar from 'tar'
import ApiStatusCodes from '../../api/ApiStatusCodes'
import DockerApi from '../../docker/DockerApi'
import DockerUtils from '../../docker/DockerUtils'
import { BackupMeta, RestoringInfo } from '../../models/BackupMeta'
import CaptainConstants from '../../utils/CaptainConstants'
import Logger from '../../utils/Logger'
import Utils from '../../utils/Utils'
import Authenticator from '../Authenticator'
import CertbotManager from './CertbotManager'
const SshClient = SshClientImport.Client

const CURRENT_NODE_DONT_CHANGE = 'CURRENT_NODE_DONT_CHANGE'
const IP_PLACEHOLDER = 'replace-me-with-new-ip-or-empty-see-docs'

const BACKUP_JSON = 'backup.json'
const RESTORE_INSTRUCTIONS = 'restore-instructions.json'

const RESTORE_INSTRUCTIONS_ABS_PATH = `${CaptainConstants.restoreDirectoryPath}/${RESTORE_INSTRUCTIONS}`

export interface IBackupCallbacks {
    getNodesInfo: () => Promise<ServerDockerInfo[]>
    getCaptainSalt: () => string
    getCertbotManager: () => CertbotManager
}

const BACKUP_META_DATA_ABS_PATH = `${CaptainConstants.restoreDirectoryPath}/meta/${BACKUP_JSON}`
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

    startRestorationIfNeededPhase1(captainIpAddress: string) {
        // if (/captain/restore/restore-instructions.json does exist):
        // - Connect all extra nodes via SSH and get their NodeID
        // - Replace the nodeId in apps with the new nodeId based on restore-instructions.json
        // - Create a captain-salt secret using the data in restore
        // - Copy restore files to proper places

        if (!fs.pathExistsSync(RESTORE_INSTRUCTIONS_ABS_PATH)) return

        const oldNodeIdToNewIpMap: IHashMapGeneric<string> = {}

        return Promise.resolve()
            .then(function () {
                Logger.d('Starting restoration, phase-1.')

                return fs.readJson(RESTORE_INSTRUCTIONS_ABS_PATH)
            })
            .then(function (restoringInfo: RestoringInfo) {
                const ps: (() => Promise<void>)[] = []
                restoringInfo.nodesMapping.forEach((n) => {
                    let isManager = false

                    restoringInfo.oldNodesForReference.forEach((oldN) => {
                        if (oldN.nodeData.ip === n.oldIp) {
                            oldNodeIdToNewIpMap[oldN.nodeData.nodeId] =
                                n.newIp === CURRENT_NODE_DONT_CHANGE
                                    ? captainIpAddress
                                    : n.newIp
                            if (oldN.nodeData.type === 'manager') {
                                isManager = true
                            }
                        }
                    })

                    if (n.newIp === CURRENT_NODE_DONT_CHANGE) return

                    const NEW_IP = n.newIp
                    const PRIVATE_KEY_PATH = n.privateKeyPath

                    ps.push(function () {
                        return Promise.resolve()
                            .then(function () {
                                Logger.d(
                                    `Joining other node to swarm: ${NEW_IP}`
                                )
                                return DockerUtils.joinDockerNode(
                                    DockerApi.get(),
                                    'root',
                                    22,
                                    captainIpAddress,
                                    isManager,
                                    NEW_IP,
                                    fs.readFileSync(PRIVATE_KEY_PATH, 'utf8')
                                )
                            })
                            .then(function () {
                                Logger.d(`Joined swarm: ${NEW_IP}`)
                            })
                            .then(function () {
                                Logger.d('Waiting 5 seconds...')
                                return Utils.getDelayedPromise(5000)
                            })
                    })
                })

                if (ps.length > 0) {
                    Logger.d('Joining other node to swarm started')
                } else {
                    Logger.d('Single node restoration detected.')
                }

                return Utils.runPromises(ps)
            })
            .then(function () {
                Logger.d('Waiting for 5 seconds for things to settle...')
                return Utils.getDelayedPromise(5000)
            })
            .then(function () {
                Logger.d('Getting nodes info...')
                return DockerApi.get().getNodesInfo()
            })
            .then(function (nodesInfo) {
                Logger.d('Remapping nodesId in config...')
                function getNewNodeIdForIp(ip: string) {
                    let nodeId = ''
                    nodesInfo.forEach((n) => {
                        if (n.ip === ip) nodeId = n.nodeId
                    })

                    if (nodeId) return nodeId

                    throw new Error(`No NodeID found for ${ip}`)
                }

                const configFilePathRestoring =
                    CaptainConstants.restoreDirectoryPath +
                    '/data/config-captain.json'
                const configData: {
                    appDefinitions: IHashMapGeneric<IAppDefSaved>
                } = fs.readJsonSync(configFilePathRestoring)

                Object.keys(configData.appDefinitions).forEach((appName) => {
                    const oldNodeIdForApp =
                        configData.appDefinitions[appName].nodeId

                    if (!oldNodeIdForApp) return

                    let oldNodeIdFound = false
                    Object.keys(oldNodeIdToNewIpMap).forEach((oldNodeId) => {
                        const newIp = oldNodeIdToNewIpMap[oldNodeId]
                        if (oldNodeIdForApp === oldNodeId) {
                            oldNodeIdFound = true
                            configData.appDefinitions[appName].nodeId = newIp
                                ? getNewNodeIdForIp(newIp)
                                : '' // If user removed new IP, it will mean that the user is okay with this node being automatically assigned to a node ID
                        }
                    })

                    if (!oldNodeIdFound) {
                        throw new Error(
                            `Old nodeId ${oldNodeIdForApp} for app ${appName} is not found in the map.`
                        )
                    }
                })

                return fs.outputJson(configFilePathRestoring, configData)
            })
            .then(function () {
                Logger.d('Config remapping done.')
                return fs.readJson(BACKUP_META_DATA_ABS_PATH)
            })
            .then(function (data: BackupMeta) {
                const salt = data.salt

                if (!salt)
                    throw new Error(
                        'Something is wrong! Salt is empty in restoring meta file'
                    )

                Logger.d('Setting up salt...')

                return DockerApi.get().ensureSecret(
                    CaptainConstants.captainSaltSecretKey,
                    salt
                )
            })
            .then(function () {
                return fs.move(
                    CaptainConstants.restoreDirectoryPath + '/data',
                    CaptainConstants.captainDataDirectory
                )
            })
            .then(function () {
                Logger.d(
                    'Restoration Phase-1 is completed! Starting the service...'
                )
            })
    }

    startRestorationIfNeededPhase2(
        captainSalt: string,
        ensureAllAppsInited: () => Promise<void>
    ) {
        // if (/captain/restore/restore.json exists) GO TO RESTORE MODE:
        // - Double check salt against "meta/captain-salt"
        // - Iterate over all APPs and make sure they are inited properly
        // - Delete /captain/restore
        // - Wait until things settle (1 minute...)

        return Promise.resolve() //
            .then(function () {
                if (!fs.pathExistsSync(RESTORE_INSTRUCTIONS_ABS_PATH)) {
                    return
                }

                Logger.d('Running phase-2 of restoration...')

                return Promise.resolve() //
                    .then(function () {
                        return fs.readJson(BACKUP_META_DATA_ABS_PATH)
                    })
                    .then(function (data: BackupMeta) {
                        const restoringSalt = data.salt
                        if (restoringSalt !== captainSalt) {
                            throw new Error(
                                `Salt does not match the restoration data: ${captainSalt} vs  ${restoringSalt}`
                            )
                        }

                        return ensureAllAppsInited()
                    })
                    .then(function () {
                        Logger.d(
                            'waiting 20 seconds for all services to settle'
                        )
                        return Utils.getDelayedPromise(20000)
                    })
                    .then(function () {
                        return fs.remove(CaptainConstants.restoreDirectoryPath)
                    })
            })
    }

    checkAndPrepareRestoration() {
        const self = this
        return Promise.resolve() //
            .then(function () {
                let promise = Promise.resolve()

                if (fs.pathExistsSync(CaptainConstants.restoreTarFilePath)) {
                    Logger.d(
                        'Backup file found! Starting restoration process...'
                    )
                    promise = self
                        .extractBackupContentAndRemoveTar() //
                        .then(function () {
                            Logger.d('Restoration content are extracted.')
                            return self.createRestorationInstructionFile()
                        })
                }

                return promise //
                    .then(function () {
                        if (fs.pathExistsSync(RESTORE_INSTRUCTIONS_ABS_PATH)) {
                            Logger.d('Resuming restoration from backup...')
                            return self.checkAccessToAllNodesInInstructions(
                                fs.readJsonSync(RESTORE_INSTRUCTIONS_ABS_PATH)
                            )
                        } else {
                            Logger.d('Fresh installation!')
                        }
                    })
            })
    }

    checkAccessToAllNodesInInstructions(restoringInfo: RestoringInfo) {
        const self = this

        Logger.d('Processing the restoration instructions...')

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

        restoringInfo.nodesMapping.forEach((n) => {
            if (n.newIp === CURRENT_NODE_DONT_CHANGE) {
                currentNodeFound = true
            }
        })

        if (!currentNodeFound)
            throw new Error(
                `You are not supposed to change ${CURRENT_NODE_DONT_CHANGE}`
            )

        const connectingFuncs: (() => Promise<void>)[] = []

        const newIps: string[] = []

        restoringInfo.nodesMapping.forEach((n) => {
            if (!Utils.isValidIp(n.oldIp)) {
                throw new Error(`${n.oldIp} is not a valid IP`)
            }

            if (n.newIp === CURRENT_NODE_DONT_CHANGE) return

            if (!!n.newIp) {
                if (n.newIp === IP_PLACEHOLDER) {
                    Logger.d(
                        '***       MULTI-NODE RESTORATION DETECTED        ***'
                    )
                    Logger.d(
                        '*** THIS ERROR IS EXPECTED. SEE DOCS FOR DETAILS ***'
                    )
                    Logger.d(
                        `See backup docs! You must replace the place holder: ${IP_PLACEHOLDER} in ${RESTORE_INSTRUCTIONS_ABS_PATH}`
                    )

                    process.exit(1)

                    throw new Error('See docs for details')
                }

                if (!Utils.isValidIp(n.newIp)) {
                    throw new Error(`${n.newIp} is not a valid IP`)
                }

                if (newIps.indexOf(n.newIp) >= 0) {
                    throw new Error(`${n.newIp} is repeated!!`)
                }

                newIps.push(n.newIp)

                connectingFuncs.push(function () {
                    return self.checkSshRoot(n.newIp, n.user, n.privateKeyPath)
                })
            }
        })

        Logger.d('Processing restoration instructions is done')
        if (connectingFuncs.length > 0)
            Logger.d('Checking connectivity to other nodes...')
        return Utils.runPromises(connectingFuncs)
    }

    checkSshRoot(
        remoteNodeIpAddress: string,
        user: string,
        privateKeyPath: string
    ) {
        return Promise.resolve() //
            .then(function () {
                if (!remoteNodeIpAddress) throw new Error('ip cannot be empty')

                if (!user) throw new Error('user cannot be empty')

                if (!privateKeyPath)
                    throw new Error('privateKeyPath cannot be empty')

                if (!fs.pathExistsSync(privateKeyPath))
                    throw new Error(
                        `private key is not found at ${privateKeyPath}`
                    )

                return fs.readFile(privateKeyPath, 'utf8')
            })
            .then(function (privateKey) {
                Logger.d(`Testing ${remoteNodeIpAddress}`)

                return new Promise<string>(function (resolve, reject) {
                    const conn = new SshClient()
                    conn.on('error', function (err) {
                        Logger.e(err)
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                'SSH Connection error!!'
                            )
                        )
                    })
                        .on('ready', function () {
                            Logger.d('SSH Client :: ready')
                            conn.exec('docker info', function (err, stream) {
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
                                    .on(
                                        'close',
                                        function (
                                            code: string,
                                            signal: string
                                        ) {
                                            Logger.d(
                                                `Stream :: close :: code: ${code}, signal: ${signal}`
                                            )
                                            conn.end()
                                            if (hasExisted) {
                                                return
                                            }
                                            hasExisted = true
                                            resolve(dataReceived.join(''))
                                        }
                                    )
                                    .on('data', function (data: string) {
                                        Logger.d(`STDOUT: ${data}`)
                                        dataReceived.push(data)
                                    })
                                    .stderr.on('data', function (data) {
                                        Logger.e(`STDERR: ${data}`)
                                        if (hasExisted) {
                                            return
                                        }
                                        hasExisted = true
                                        reject(
                                            ApiStatusCodes.createError(
                                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                                `Error during setup: ${data}`
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
            .then(function (data) {
                if (data.toUpperCase().indexOf('SWARM: INACTIVE') < 0) {
                    throw new Error(
                        `Either not root or already part of swarm? The output must include "Swarm: inactive" from ${remoteNodeIpAddress}`
                    )
                }
                Logger.d(`Passed ${remoteNodeIpAddress}`)
            })
    }

    /**
     * By the time this method finishes, the instructions will be ready at
     *
     * /captain/restore/restore-instructions.json
     *
     */
    private createRestorationInstructionFile() {
        const self = this
        return Promise.resolve() //
            .then(function () {
                const dirPath = CaptainConstants.restoreDirectoryPath

                if (!fs.statSync(dirPath).isDirectory())
                    throw new Error('restore directory is not a directory!!')

                if (fs.pathExistsSync(RESTORE_INSTRUCTIONS_ABS_PATH)) {
                    throw new Error(
                        'Restore instruction already exists! Cleanup your /captain directory and start over.'
                    )
                }

                return Promise.resolve() //
                    .then(function () {
                        Logger.d('Reading backup meta-data...')

                        const metaData = fs.readJsonSync(
                            BACKUP_META_DATA_ABS_PATH
                        )

                        const configData = fs.readJsonSync(
                            CaptainConstants.restoreDirectoryPath +
                                '/data/config-captain.json'
                        )

                        Logger.d('Creating the restoration instruction file...')

                        return fs.outputFile(
                            RESTORE_INSTRUCTIONS_ABS_PATH,
                            JSON.stringify(
                                self.createRestoreInstructionData(
                                    metaData,
                                    configData
                                ),
                                undefined,
                                2
                            )
                        )
                    })
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

        oldServers.forEach((s) => {
            if (s.isLeader) {
                ret.nodesMapping.push({
                    newIp: CURRENT_NODE_DONT_CHANGE,
                    oldIp: s.ip,
                    privateKeyPath: '',
                    user: '',
                })
            } else {
                ret.nodesMapping.push({
                    newIp: IP_PLACEHOLDER,
                    oldIp: s.ip,
                    privateKeyPath:
                        CaptainConstants.captainBaseDirectory + '/id_rsa',
                    user: 'root',
                })
            }

            const apps: string[] = []

            Object.keys(configData.appDefinitions).forEach((appName) => {
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

    private extractBackupContentAndRemoveTar() {
        if (!fs.statSync(CaptainConstants.restoreTarFilePath).isFile())
            throw new Error('restore tar file is not a file!!')

        return Promise.resolve() //
            .then(function () {
                return fs.ensureDir(CaptainConstants.restoreDirectoryPath)
            })
            .then(function () {
                return tar
                    .extract({
                        file: CaptainConstants.restoreTarFilePath,
                        cwd: CaptainConstants.restoreDirectoryPath,
                    })
                    .then(function () {
                        return fs.remove(CaptainConstants.restoreTarFilePath)
                    })
                    .then(function () {
                        return Promise.resolve(true)
                    })
            })
    }

    createBackup(iBackupCallbacks: IBackupCallbacks) {
        const self = this
        const certbotManager = iBackupCallbacks.getCertbotManager()

        return Promise.resolve() //
            .then(function () {
                certbotManager.lock()
                return self
                    .createBackupInternal(iBackupCallbacks)
                    .then(function (data) {
                        certbotManager.unlock()
                        return data
                    })
                    .catch(function (err) {
                        certbotManager.unlock()
                        throw err
                    })
            })
    }

    private createBackupInternal(iBackupCallbacks: IBackupCallbacks) {
        const self = this
        let nodeInfo: ServerDockerInfo[]
        return Promise.resolve() //
            .then(function () {
                self.lock()

                // Check if exist /captain/temp/backup, delete directory
                // Create directory /captain/temp/backup/raw
                // Copy /captain/data to .../backup/raw/data
                // Ensure .../backup/raw/meta/backup.json
                // Create tar file FROM: .../backup/raw/   TO: .../backup/backup.tar

                const RAW = CaptainConstants.captainRootDirectoryBackup + '/raw'

                Logger.d('Creating backup...')

                return Promise.resolve() //
                    .then(function () {
                        return self.deleteBackupDirectoryIfExists()
                    })
                    .then(function () {
                        return fs.ensureDir(RAW)
                    })
                    .then(function () {
                        Logger.d(`Copying data to ${RAW}`)

                        const dest = RAW + '/data'

                        // We cannot use fs.copy as it doesn't properly copy the broken SymLink which might exist in LetsEncrypt
                        // https://github.com/jprichardson/node-fs-extra/issues/638
                        return new Promise(function (resolve, reject) {
                            const child = exec(
                                `mkdir -p {dest} && cp -rp  ${CaptainConstants.captainDataDirectory} ${dest}`
                            )
                            child.addListener('error', reject)
                            child.addListener('exit', resolve)
                        })
                    })
                    .then(function () {
                        return iBackupCallbacks.getNodesInfo()
                    })
                    .then(function (nodes) {
                        Logger.d(`Copying meta to ${RAW}`)

                        nodeInfo = nodes

                        return self.saveMetaFile(`${RAW}/meta/${BACKUP_JSON}`, {
                            salt: iBackupCallbacks.getCaptainSalt(),
                            nodes: nodes,
                        })
                    })
                    .then(function () {
                        const tarFilePath =
                            CaptainConstants.captainRootDirectoryBackup +
                            '/backup.tar'

                        Logger.d(`Creating tar file: ${tarFilePath}`)

                        return tar
                            .c(
                                {
                                    file: tarFilePath,
                                    cwd: RAW,
                                },
                                ['./']
                            )
                            .then(function () {
                                let fileSizeInMb = Math.ceil(
                                    fs.statSync(tarFilePath).size / 1000000
                                )

                                Logger.d(
                                    `Tar file created. File Size: ${fileSizeInMb} MB`
                                )

                                return tarFilePath
                            })
                    })
                    .then(function (tarFilePath) {
                        const namespace = CaptainConstants.rootNameSpace
                        let mainIP = ''

                        nodeInfo.forEach((n) => {
                            if (n.isLeader)
                                mainIP = (n.ip || '').split('.').join('_')
                        })

                        const now = moment()
                        const newName = `${
                            CaptainConstants.captainDownloadsDirectory
                        }/${namespace}/caprover-backup-${`${now.format(
                            'YYYY_MM_DD-HH_mm_ss'
                        )}-${now.valueOf()}`}${`-ip-${mainIP}.tar`}`
                        fs.moveSync(tarFilePath, newName)

                        setTimeout(() => {
                            try {
                                fs.removeSync(newName)
                            } catch (err) {
                                // nom nom
                            }
                        }, 1000 * 3600 * 2)

                        return Authenticator.getAuthenticator(
                            namespace
                        ).getDownloadToken(path.basename(newName))
                    })
                    .then(function (token) {
                        return self
                            .deleteBackupDirectoryIfExists()
                            .then(function () {
                                self.unlock()
                                return {
                                    downloadToken: token,
                                }
                            })
                    })
                    .catch(function (err) {
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
            .then(function () {
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
