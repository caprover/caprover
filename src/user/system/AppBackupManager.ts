import { CronJob } from 'cron'
import * as fs from 'fs-extra'
import * as path from 'path'
import { v4 as uuid } from 'uuid'
import ApiStatusCodes from '../../api/ApiStatusCodes'
import AppBackupDataStore from '../../datastore/AppBackupDataStore'
import DataStore from '../../datastore/DataStore'
import DockerApi from '../../docker/DockerApi'
import {
    IAppBackupConfig,
    IBackupJobRecord,
    IBackupJobType,
    IRcloneRemote,
} from '../../models/AppBackup'
import { IAppVolume } from '../../models/AppDefinition'
import CaptainConstants from '../../utils/CaptainConstants'
import Logger from '../../utils/Logger'
import Utils from '../../utils/Utils'

// Fixed remote name used inside the generated rclone.conf. The user-facing
// name lives in the datastore; inside each ephemeral job the remote is always
// addressed as "remote:".
const RCLONE_REMOTE_NAME = 'remote'
const RCLONE_IMAGE = 'rclone/rclone:latest'
const CONTAINER_CONFIG_DIR = '/config/rclone'
const CONTAINER_LOGS_DIR = '/logs'
const CONTAINER_DATA_DIR = '/data'

export default class AppBackupManager {
    private jobs: { [appName: string]: CronJob } = {}
    // App names with an in-flight (backup or restore) run — prevents overlap.
    private running: Set<string> = new Set()

    constructor(
        private dataStore: DataStore,
        private dockerApi: DockerApi
    ) {}

    private store(): AppBackupDataStore {
        return this.dataStore.getAppBackupDataStore()
    }

    init() {
        const self = this
        return Promise.resolve()
            .then(function () {
                return fs.ensureDir(CaptainConstants.appBackupsLogsPathOnHost)
            })
            .then(function () {
                return self.resetScheduledTasks()
            })
            .catch(function (err) {
                Logger.e('App backup manager failed to start.')
                Logger.e(err)
            })
    }

    // ------------------------------------------------------------- scheduling

    resetScheduledTasks() {
        const self = this

        Object.keys(self.jobs).forEach(function (appName) {
            self.jobs[appName].stop()
        })
        self.jobs = {}

        return self
            .store()
            .getAllConfigs()
            .then(function (configs) {
                Object.keys(configs).forEach(function (appName) {
                    const config = configs[appName]
                    if (
                        config.enabled &&
                        config.cronSchedule &&
                        Utils.validateCron(config.cronSchedule)
                    ) {
                        self.jobs[appName] = new CronJob(
                            config.cronSchedule,
                            function () {
                                self.runBackup(appName).catch(function (err) {
                                    Logger.e(
                                        `Scheduled backup for ${appName} failed to start`
                                    )
                                    Logger.e(err)
                                })
                            },
                            null,
                            true,
                            config.timezone || undefined
                        )
                    }
                })
            })
    }

    // --------------------------------------------------------------- configs

    getAppConfig(appName: string) {
        return this.store().getAppConfig(appName)
    }

    setAppConfig(appName: string, config: IAppBackupConfig) {
        const self = this
        return Promise.resolve()
            .then(function () {
                config.cronSchedule = (config.cronSchedule || '').trim()
                if (
                    config.cronSchedule &&
                    !Utils.validateCron(config.cronSchedule)
                ) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'Invalid cron schedule'
                    )
                }
                if (
                    config.retentionDays !== undefined &&
                    config.retentionDays < 0
                ) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'Retention days cannot be negative'
                    )
                }
                if (!config.volumeNames || config.volumeNames.length === 0) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'At least one volume must be selected'
                    )
                }
                // Ensure the referenced remote exists.
                return self.store().getRemoteById(config.remoteId)
            })
            .then(function () {
                return self.store().setAppConfig(appName, config)
            })
            .then(function () {
                return self.resetScheduledTasks()
            })
    }

    deleteAppConfig(appName: string) {
        const self = this
        return self
            .store()
            .deleteAppConfig(appName)
            .then(function () {
                return self.resetScheduledTasks()
            })
    }

    // ----------------------------------------------------------------- remote

    listRemotes() {
        return this.store().getAllRemotesMasked()
    }

    createRemote(
        name: string,
        type: IRcloneRemote['type'],
        params: { [k: string]: string }
    ) {
        return this.store().addRemote(name, type, params)
    }

    updateRemote(id: string, name: string, params: { [k: string]: string }) {
        return this.store().updateRemote(id, name, params)
    }

    deleteRemote(id: string) {
        return this.store().deleteRemote(id)
    }

    testRemote(remoteId: string): Promise<{ ok: boolean; output: string }> {
        const self = this
        return self
            .store()
            .getRemoteById(remoteId)
            .then(function (remote) {
                const jobId = `test-${uuid()}`
                const confDir = path.join(
                    CaptainConstants.appBackupsRcloneConfigDir,
                    jobId
                )
                return self
                    .writeRcloneConfig(confDir, remote)
                    .then(function () {
                        return self.runRcloneContainer(
                            ['lsd', `${RCLONE_REMOTE_NAME}:`],
                            confDir,
                            [],
                            jobId
                        )
                    })
                    .then(function (exitCode) {
                        return {
                            ok: exitCode === 0,
                            output: self.readJobLog(jobId),
                        }
                    })
                    .finally(function () {
                        fs.remove(confDir).catch(() => undefined)
                    })
            })
    }

    // ------------------------------------------------------------- backup/run

    /**
     * Starts a backup for the app. Returns the job id immediately; progress is
     * tracked in the job record and its log file.
     */
    runBackup(appName: string): Promise<string> {
        return this.startJob(appName, 'backup')
    }

    /**
     * Restores the app's configured volumes from the remote (latest state).
     * Returns the job id immediately.
     */
    runRestore(appName: string): Promise<string> {
        return this.startJob(appName, 'restore')
    }

    listJobs(appName: string) {
        return this.store().getJobs(appName)
    }

    getJobLog(appName: string, jobId: string): Promise<string> {
        const self = this
        return self
            .store()
            .getJobById(jobId)
            .then(function (job) {
                if (!job || job.appName !== appName) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.NOT_FOUND,
                        'Backup job not found'
                    )
                }
                return self.readJobLog(jobId)
            })
    }

    private startJob(appName: string, type: IBackupJobType): Promise<string> {
        const self = this

        if (self.running.has(appName)) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.ILLEGAL_OPERATION,
                'A backup/restore is already running for this app'
            )
        }

        let jobId = ''
        let config: IAppBackupConfig
        let remote: IRcloneRemote

        return Promise.resolve()
            .then(function () {
                return self.store().getAppConfig(appName)
            })
            .then(function (cfg) {
                if (!cfg || !cfg.enabled) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'Backup is not configured for this app'
                    )
                }
                config = cfg
                return self.store().getRemoteById(config.remoteId)
            })
            .then(function (r) {
                remote = r
                jobId = `${type}-${uuid()}`
                self.running.add(appName)
                const record: IBackupJobRecord = {
                    id: jobId,
                    appName,
                    type,
                    remoteId: config.remoteId,
                    volumeNames: config.volumeNames,
                    status: 'running',
                    startedAt: Date.now(),
                    logFile: `${jobId}.log`,
                }
                return self.store().addJob(record)
            })
            .then(function () {
                // Fire-and-forget: the heavy lifting runs detached so the API
                // call returns immediately. Status is persisted on the record.
                self.executeJob(appName, jobId, type, config, remote)
                    .then(function (exitCode) {
                        return self.store().updateJob(jobId, {
                            status: exitCode === 0 ? 'success' : 'failed',
                            finishedAt: Date.now(),
                            exitCode,
                        })
                    })
                    .catch(function (err) {
                        Logger.e(err)
                        return self.store().updateJob(jobId, {
                            status: 'failed',
                            finishedAt: Date.now(),
                            error: `${err}`,
                        })
                    })
                    .finally(function () {
                        self.running.delete(appName)
                    })
                return jobId
            })
            .catch(function (err) {
                self.running.delete(appName)
                throw err
            })
    }

    private executeJob(
        appName: string,
        jobId: string,
        type: IBackupJobType,
        config: IAppBackupConfig,
        remote: IRcloneRemote
    ): Promise<number> {
        const self = this
        const confDir = path.join(
            CaptainConstants.appBackupsRcloneConfigDir,
            jobId
        )

        return Promise.resolve()
            .then(function () {
                return self.dataStore
                    .getAppsDataStore()
                    .getAppDefinition(appName)
            })
            .then(function (app) {
                return self
                    .writeRcloneConfig(confDir, remote)
                    .then(function () {
                        return app
                    })
            })
            .then(function (app) {
                const isLegacy = !!app.isLegacyAppName
                const appVolumes = app.volumes || []

                // Resolve each configured logical volume to a physical docker
                // volume name. Only named volumes are supported in v1.
                const targets = config.volumeNames
                    .map(function (logicalName) {
                        const vol = appVolumes.find(
                            (v) => v.volumeName === logicalName
                        )
                        if (!vol || !vol.volumeName) return undefined
                        return {
                            logicalName,
                            physicalName: self.dataStore
                                .getAppsDataStore()
                                .getVolumeName(vol.volumeName, isLegacy),
                        }
                    })
                    .filter(
                        (
                            t
                        ): t is { logicalName: string; physicalName: string } =>
                            !!t
                    )

                if (targets.length === 0) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_OPERATION,
                        'No matching named volumes found for this app'
                    )
                }

                // Run volumes sequentially, aggregating the worst exit code.
                let worstExit = 0
                let chain: Promise<void> = Promise.resolve()
                targets.forEach(function (target) {
                    chain = chain.then(function () {
                        const remotePathBase = `${RCLONE_REMOTE_NAME}:${AppBackupManager.joinRemotePath(
                            remote,
                            config.remotePath,
                            appName,
                            target.logicalName
                        )}`
                        const dest = `${remotePathBase}/current`
                        const volMount: IAppVolume = {
                            volumeName: undefined,
                            hostPath: target.physicalName,
                            containerPath: CONTAINER_DATA_DIR,
                            mode: type === 'backup' ? 'ro' : 'rw',
                        }

                        const command =
                            type === 'backup'
                                ? self.buildBackupCommand(
                                      dest,
                                      remotePathBase,
                                      config
                                  )
                                : ['sync', dest, CONTAINER_DATA_DIR]

                        return self
                            .runRcloneContainer(
                                command,
                                confDir,
                                [volMount],
                                jobId
                            )
                            .then(function (exitCode) {
                                if (exitCode !== 0) worstExit = exitCode
                            })
                    })
                })

                return chain.then(function () {
                    return worstExit
                })
            })
            .finally(function () {
                fs.remove(confDir).catch(() => undefined)
            })
    }

    private buildBackupCommand(
        dest: string,
        remotePathBase: string,
        config: IAppBackupConfig
    ): string[] {
        const command = ['sync', CONTAINER_DATA_DIR, dest]
        if (config.retentionDays && config.retentionDays > 0) {
            // Keep overwritten/deleted files as a timestamped snapshot next to
            // (not inside) the sync destination.
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            command.push('--backup-dir', `${remotePathBase}/snapshots/${ts}`)
        }
        return command
    }

    // ----------------------------------------------------------- rclone infra

    private runRcloneContainer(
        rcloneArgs: string[],
        confDir: string,
        dataVolumes: IAppVolume[],
        jobId: string
    ): Promise<number> {
        const self = this
        const command = rcloneArgs.concat([
            '--config',
            `${CONTAINER_CONFIG_DIR}/rclone.conf`,
            '--log-file',
            `${CONTAINER_LOGS_DIR}/${jobId}.log`,
            '--log-level',
            'INFO',
            '--stats',
            '30s',
            '--stats-log-level',
            'NOTICE',
        ])

        const volumes: IAppVolume[] = dataVolumes.concat([
            {
                volumeName: undefined,
                hostPath: confDir,
                containerPath: CONTAINER_CONFIG_DIR,
                mode: 'ro',
            },
            {
                volumeName: undefined,
                hostPath: CaptainConstants.appBackupsLogsPathOnHost,
                containerPath: CONTAINER_LOGS_DIR,
                mode: 'rw',
            },
        ])

        return self.dockerApi
            .createContainer({
                imageName: RCLONE_IMAGE,
                command,
                volumes,
                network: CaptainConstants.captainNetworkName,
                arrayOfEnvKeyAndValue: [],
                sticky: false,
                wait: true,
            })
            .then(function (result: any) {
                // container.wait() resolves with { StatusCode }
                return result && typeof result.StatusCode === 'number'
                    ? result.StatusCode
                    : 0
            })
    }

    private writeRcloneConfig(
        confDir: string,
        remote: IRcloneRemote
    ): Promise<void> {
        const { body, files } = AppBackupManager.buildRcloneConf(remote)
        return fs
            .ensureDir(confDir)
            .then(function () {
                return fs.writeFile(path.join(confDir, 'rclone.conf'), body, {
                    mode: 0o600,
                })
            })
            .then(function () {
                return Promise.all(
                    files.map((f) =>
                        fs.writeFile(path.join(confDir, f.name), f.content, {
                            mode: 0o600,
                        })
                    )
                ).then(() => undefined)
            })
    }

    /**
     * Builds an rclone.conf body (single `[remote]` section) plus any auxiliary
     * files (keys, service-account JSON) that need to be mounted alongside it.
     */
    static buildRcloneConf(remote: IRcloneRemote): {
        body: string
        files: { name: string; content: string }[]
    } {
        const p = remote.params || {}
        const files: { name: string; content: string }[] = []
        const lines: string[] = [`[${RCLONE_REMOTE_NAME}]`]

        switch (remote.type) {
            case 's3':
                lines.push('type = s3')
                lines.push(`provider = ${p.provider || 'Other'}`)
                lines.push(`access_key_id = ${p.access_key_id || ''}`)
                lines.push(`secret_access_key = ${p.secret_access_key || ''}`)
                if (p.endpoint) lines.push(`endpoint = ${p.endpoint}`)
                if (p.region) lines.push(`region = ${p.region}`)
                break
            case 'b2':
                lines.push('type = b2')
                lines.push(`account = ${p.account || ''}`)
                lines.push(`key = ${p.key || ''}`)
                break
            case 'gdrive':
                lines.push('type = drive')
                lines.push('scope = drive')
                lines.push(
                    `service_account_file = ${CONTAINER_CONFIG_DIR}/gdrive-sa.json`
                )
                if (p.root_folder_id)
                    lines.push(`root_folder_id = ${p.root_folder_id}`)
                files.push({
                    name: 'gdrive-sa.json',
                    content: p.service_account_json || '',
                })
                break
            case 'sftp':
                lines.push('type = sftp')
                lines.push(`host = ${p.host || ''}`)
                lines.push(`user = ${p.user || ''}`)
                lines.push(`port = ${p.port || '22'}`)
                lines.push(`key_file = ${CONTAINER_CONFIG_DIR}/id_key`)
                files.push({
                    name: 'id_key',
                    content: p.private_key || '',
                })
                break
            case 'raw':
                // The user pastes the section body verbatim.
                lines.push((p.conf || '').trim())
                break
            default:
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    `Unknown remote type: ${remote.type}`
                )
        }

        return { body: lines.join('\n') + '\n', files }
    }

    private static joinRemotePath(
        remote: IRcloneRemote,
        remotePath: string,
        appName: string,
        volumeName: string
    ): string {
        const clean = (remotePath || '').replace(/^\/+|\/+$/g, '')
        const prefix = clean ? `${clean}/` : ''
        return `${prefix}${appName}/${volumeName}`
    }

    private readJobLog(jobId: string): string {
        const logPath = path.join(
            CaptainConstants.appBackupsLogsPathOnHost,
            `${jobId}.log`
        )
        try {
            return fs.readFileSync(logPath, 'utf8')
        } catch (e) {
            return ''
        }
    }
}
