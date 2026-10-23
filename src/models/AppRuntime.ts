export enum AppRuntimeStatus {
    Running = 'running',
    Degraded = 'degraded',
    Stopped = 'stopped',
    Unavailable = 'unavailable',
}

export enum TaskState {
    New = 'new',
    Pending = 'pending',
    Assigned = 'assigned',
    Accepted = 'accepted',
    Ready = 'ready',
    Preparing = 'preparing',
    Starting = 'starting',
    Running = 'running',
    Complete = 'complete',
    Shutdown = 'shutdown',
    Failed = 'failed',
    Rejected = 'rejected',
    Orphaned = 'orphaned',
    Remove = 'remove',
}

export interface RuntimeTask {
    taskId: string
    slot: number | null
    nodeId: string | null
    nodeName: string | null
    image: string
    state: TaskState
    desiredState: TaskState
    /** Time the task entered its current state, used for "running for". */
    stateChangedAt: string | null
    message: string
    error: string | null
    exitCode: number | null
}

export interface RuntimeFailure {
    taskId: string
    occurredAt: string | null
    error: string
}

export interface AppRuntime {
    appName: string
    status: AppRuntimeStatus
    desiredInstances: number | null
    runningInstances: number | null
    currentTasks: RuntimeTask[]
    latestFailure: RuntimeFailure | null
    /** Collection failure; distinct from an application's task failure. */
    error: string | null
}

export interface AppRuntimeDetails extends AppRuntime {
    /** Most recent historical tasks first; at most ten per app. */
    taskHistory: RuntimeTask[]
}

export interface AppsRuntimeResponse {
    apps: AppRuntime[]
}
