import { IHashMapGeneric } from './ICacheGeneric'

/**
 * Types of rclone remotes exposed through the GUI. `raw` lets the user paste a
 * full rclone.conf section body for any backend rclone supports.
 */
export type IRcloneRemoteType = 's3' | 'b2' | 'gdrive' | 'sftp' | 'raw'

export const RCLONE_REMOTE_TYPES: IRcloneRemoteType[] = [
    's3',
    'b2',
    'gdrive',
    'sftp',
    'raw',
]

/**
 * A configured rclone remote, with its credentials in clear text. This shape is
 * only ever used server-side; credentials are encrypted at rest and never
 * returned to the client (see IRcloneRemoteMasked).
 */
export interface IRcloneRemote {
    id: string
    name: string
    type: IRcloneRemoteType
    params: IHashMapGeneric<string>
}

/** Persisted shape: params serialized then encrypted. */
export interface IRcloneRemoteEncrypted {
    id: string
    name: string
    type: IRcloneRemoteType
    paramsEncrypted: string
}

/** Shape returned to the client — never carries secrets. */
export interface IRcloneRemoteMasked {
    id: string
    name: string
    type: IRcloneRemoteType
}

/** Per-app backup configuration. */
export interface IAppBackupConfig {
    enabled: boolean
    remoteId: string
    /** Base destination path on the remote, e.g. "my-bucket/caprover". */
    remotePath: string
    /** Logical volume names (as in AppDefinition.volumes[].volumeName) to back up. */
    volumeNames: string[]
    /** Standard cron expression. Empty means manual-only (no schedule). */
    cronSchedule?: string
    timezone?: string
    /**
     * When > 0, each run keeps a timestamped snapshot of overwritten/deleted
     * files and prunes snapshots older than this many days. 0/undefined mirrors
     * only (latest state, no history).
     */
    retentionDays?: number
}

export type IBackupJobType = 'backup' | 'restore'
export type IBackupJobStatus = 'running' | 'success' | 'failed'

export interface IBackupJobRecord {
    id: string
    appName: string
    type: IBackupJobType
    remoteId: string
    volumeNames: string[]
    status: IBackupJobStatus
    startedAt: number
    finishedAt?: number
    exitCode?: number
    error?: string
    /** Log file name (relative to the app-backups log directory). */
    logFile: string
}
