import { v4 as uuid } from 'uuid'
import ApiStatusCodes from '../api/ApiStatusCodes'
import {
    IAppBackupConfig,
    IBackupJobRecord,
    IRcloneRemote,
    IRcloneRemoteEncrypted,
    IRcloneRemoteMasked,
    IRcloneRemoteType,
} from '../models/AppBackup'
import { IHashMapGeneric } from '../models/ICacheGeneric'
import CaptainEncryptor from '../utils/Encryptor'
import configstore = require('configstore')

const APP_BACKUP_REMOTES = 'appBackupRemotes'
const APP_BACKUP_CONFIGS = 'appBackupConfigs'
const APP_BACKUP_JOBS = 'appBackupJobs'

// Keep the persisted job history bounded.
const MAX_JOB_HISTORY = 200

class AppBackupDataStore {
    private encryptor: CaptainEncryptor

    constructor(
        private data: configstore,
        public namepace: string
    ) {}

    setEncryptor(encryptor: CaptainEncryptor) {
        this.encryptor = encryptor
    }

    // ------------------------------------------------------------------ remotes

    getAllRemotes(): Promise<IRcloneRemote[]> {
        const self = this
        return Promise.resolve()
            .then(function () {
                return (self.data.get(APP_BACKUP_REMOTES) ||
                    []) as IRcloneRemoteEncrypted[]
            })
            .then(function (remotes) {
                return remotes.map(function (r) {
                    return {
                        id: r.id,
                        name: r.name,
                        type: r.type,
                        params: JSON.parse(
                            self.encryptor.decrypt(r.paramsEncrypted)
                        ) as IHashMapGeneric<string>,
                    }
                })
            })
    }

    getAllRemotesMasked(): Promise<IRcloneRemoteMasked[]> {
        const self = this
        return Promise.resolve()
            .then(function () {
                return (self.data.get(APP_BACKUP_REMOTES) ||
                    []) as IRcloneRemoteEncrypted[]
            })
            .then(function (remotes) {
                return remotes.map(function (r) {
                    return { id: r.id, name: r.name, type: r.type }
                })
            })
    }

    getRemoteById(remoteId: string): Promise<IRcloneRemote> {
        const self = this
        return self.getAllRemotes().then(function (remotes) {
            const found = remotes.find((r) => r.id === remoteId)
            if (!found) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.NOT_FOUND,
                    'Backup remote not found'
                )
            }
            return found
        })
    }

    addRemote(
        name: string,
        type: IRcloneRemoteType,
        params: IHashMapGeneric<string>
    ): Promise<string> {
        const self = this
        return self.getAllRemotes().then(function (remotes) {
            AppBackupDataStore.assertValidRemote(name, type, params)
            if (remotes.some((r) => r.name === name)) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'A backup remote with this name already exists'
                )
            }
            const id = uuid()
            remotes.push({ id, name, type, params })
            self.saveAllRemotes(remotes)
            return id
        })
    }

    updateRemote(
        id: string,
        name: string,
        params: IHashMapGeneric<string>
    ): Promise<void> {
        const self = this
        return self.getAllRemotes().then(function (remotes) {
            const found = remotes.find((r) => r.id === id)
            if (!found) {
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.NOT_FOUND,
                    'Backup remote not found'
                )
            }
            AppBackupDataStore.assertValidRemote(name, found.type, params)
            found.name = name
            found.params = params
            self.saveAllRemotes(remotes)
        })
    }

    deleteRemote(id: string): Promise<void> {
        const self = this
        return Promise.all([self.getAllRemotes(), self.getAllConfigs()]).then(
            function ([remotes, configs]) {
                const inUseBy = Object.keys(configs).find(
                    (appName) => configs[appName].remoteId === id
                )
                if (inUseBy) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        `This remote is still used by app "${inUseBy}"`
                    )
                }
                const filtered = remotes.filter((r) => r.id !== id)
                if (filtered.length === remotes.length) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.NOT_FOUND,
                        'Backup remote not found'
                    )
                }
                self.saveAllRemotes(filtered)
            }
        )
    }

    private saveAllRemotes(remotes: IRcloneRemote[]) {
        const self = this
        const encryptedList: IRcloneRemoteEncrypted[] = remotes.map(
            function (r) {
                return {
                    id: r.id,
                    name: r.name,
                    type: r.type,
                    paramsEncrypted: self.encryptor.encrypt(
                        JSON.stringify(r.params || {})
                    ),
                }
            }
        )
        self.data.set(APP_BACKUP_REMOTES, encryptedList)
    }

    private static assertValidRemote(
        name: string,
        type: IRcloneRemoteType,
        params: IHashMapGeneric<string>
    ) {
        if (!name) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.ILLEGAL_PARAMETER,
                'Remote name is required'
            )
        }
        if (!params || typeof params !== 'object') {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.ILLEGAL_PARAMETER,
                'Remote params are required'
            )
        }
    }

    // ------------------------------------------------------------------ configs

    getAllConfigs(): Promise<IHashMapGeneric<IAppBackupConfig>> {
        const self = this
        return Promise.resolve().then(function () {
            return (self.data.get(APP_BACKUP_CONFIGS) ||
                {}) as IHashMapGeneric<IAppBackupConfig>
        })
    }

    getAppConfig(appName: string): Promise<IAppBackupConfig | undefined> {
        return this.getAllConfigs().then((configs) => configs[appName])
    }

    setAppConfig(appName: string, config: IAppBackupConfig): Promise<void> {
        const self = this
        return self.getAllConfigs().then(function (configs) {
            configs[appName] = config
            self.data.set(APP_BACKUP_CONFIGS, configs)
        })
    }

    deleteAppConfig(appName: string): Promise<void> {
        const self = this
        return self.getAllConfigs().then(function (configs) {
            delete configs[appName]
            self.data.set(APP_BACKUP_CONFIGS, configs)
        })
    }

    // --------------------------------------------------------------------- jobs

    getJobs(appName?: string): Promise<IBackupJobRecord[]> {
        const self = this
        return Promise.resolve()
            .then(function () {
                return (self.data.get(APP_BACKUP_JOBS) ||
                    []) as IBackupJobRecord[]
            })
            .then(function (jobs) {
                return appName
                    ? jobs.filter((j) => j.appName === appName)
                    : jobs
            })
    }

    getJobById(id: string): Promise<IBackupJobRecord | undefined> {
        return this.getJobs().then((jobs) => jobs.find((j) => j.id === id))
    }

    addJob(job: IBackupJobRecord): Promise<void> {
        const self = this
        return self.getJobs().then(function (jobs) {
            jobs.unshift(job)
            self.data.set(APP_BACKUP_JOBS, jobs.slice(0, MAX_JOB_HISTORY))
        })
    }

    updateJob(id: string, patch: Partial<IBackupJobRecord>): Promise<void> {
        const self = this
        return self.getJobs().then(function (jobs) {
            const found = jobs.find((j) => j.id === id)
            if (!found) return
            Object.assign(found, patch)
            self.data.set(APP_BACKUP_JOBS, jobs)
        })
    }
}

export default AppBackupDataStore
