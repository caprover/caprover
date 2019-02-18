import uuid = require('uuid/v4')
import SshClientImport = require('ssh2')
import request = require('request')
import fs = require('fs-extra')
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

const BACKUP_JSON = 'backup.json'

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

    createBackupInternal(iBackupCallbacks: IBackupCallbacks) {
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
                        return fs.outputJson(RAW + '/meta/' + BACKUP_JSON, {
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
