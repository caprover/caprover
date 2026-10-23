import type Docker = require('dockerode')
import {
    AppRuntimeDetails,
    AppRuntimeStatus,
    RuntimeTask,
    TaskState,
} from '../models/AppRuntime'

// dockerode's task/node list methods return any[]. Describe only the fields
// consumed here; raw Docker objects never become part of the public response.
export interface DockerRuntimeTask {
    ID: string
    ServiceID: string
    Slot?: number
    NodeID?: string
    CreatedAt: string
    DesiredState: string
    Spec: { ContainerSpec?: { Image?: string } }
    Status: {
        State: string
        Timestamp?: string
        Message?: string
        Err?: string
        ContainerStatus?: { ExitCode?: number }
    }
}

export interface DockerRuntimeNode {
    ID: string
    Description?: { Hostname?: string }
}

export type ServiceRuntime = Omit<AppRuntimeDetails, 'appName'>
export type DockerRuntimeService = Pick<
    Docker.Service,
    'ID' | 'Spec' | 'ServiceStatus'
>

const HISTORY_LIMIT = 10
const historicalStates = new Set<TaskState>([
    TaskState.Complete,
    TaskState.Shutdown,
    TaskState.Failed,
    TaskState.Rejected,
    TaskState.Orphaned,
    TaskState.Remove,
])

function taskState(value: string): TaskState {
    const state = Object.values(TaskState).find((state) => state === value)
    if (!state) throw new Error('Unsupported Docker task state')
    return state
}

function timestamp(value: string | undefined): number {
    return value ? Date.parse(value) || 0 : 0
}

function instanceKey(task: DockerRuntimeTask): string {
    return task.Slot ? `slot:${task.Slot}` : task.NodeID || task.ID
}

export function unavailableServiceRuntime(error: string): ServiceRuntime {
    return {
        status: AppRuntimeStatus.Unavailable,
        desiredInstances: null,
        runningInstances: null,
        currentTasks: [],
        latestFailure: null,
        error,
        taskHistory: [],
    }
}

export function getServiceRuntime(
    service: DockerRuntimeService,
    tasks: DockerRuntimeTask[],
    nodes: DockerRuntimeNode[]
): ServiceRuntime {
    const mode = service.Spec?.Mode
    const desiredInstances = mode?.Replicated
        ? (mode.Replicated.Replicas ?? 1)
        : mode?.Global
          ? service.ServiceStatus?.DesiredTasks
          : undefined
    if (
        desiredInstances === undefined ||
        !Number.isSafeInteger(desiredInstances) ||
        desiredInstances < 0
    ) {
        return unavailableServiceRuntime(
            'Unable to determine desired instances'
        )
    }

    const nodeMap = new Map(nodes.map((node) => [node.ID, node]))
    const ordered = [...tasks].sort(
        (a, b) => timestamp(b.CreatedAt) - timestamp(a.CreatedAt)
    )
    const entries = ordered.map((task) => {
        const stateChangedAt = task.Status.Timestamp
        const runtime: RuntimeTask = {
            taskId: task.ID,
            slot: task.Slot || null,
            nodeId: task.NodeID || null,
            nodeName:
                nodeMap.get(task.NodeID || '')?.Description?.Hostname || null,
            image: task.Spec.ContainerSpec?.Image || '',
            state: taskState(task.Status.State),
            desiredState: taskState(task.DesiredState),
            stateChangedAt:
                stateChangedAt && Number.isFinite(Date.parse(stateChangedAt))
                    ? stateChangedAt
                    : null,
            message: task.Status.Message || '',
            error: task.Status.Err || null,
            exitCode: task.Status.ContainerStatus?.ExitCode ?? null,
        }
        return { task, runtime }
    })
    // Retain overlapping active tasks during updates. Inactive attempts belong
    // in history, even when Docker has not scheduled a replacement yet.
    const current = entries.filter(
        ({ runtime }) => !historicalStates.has(runtime.state)
    )
    const runningInstances = new Set(
        current
            .filter(({ runtime }) => runtime.state === TaskState.Running)
            .map(({ task }) => instanceKey(task))
    )
    const byStateTime = [...entries].sort(
        (a, b) =>
            timestamp(b.task.Status.Timestamp || b.task.CreatedAt) -
            timestamp(a.task.Status.Timestamp || a.task.CreatedAt)
    )
    const failure = byStateTime.find(
        ({ runtime }) =>
            runtime.state === TaskState.Failed ||
            runtime.state === TaskState.Rejected ||
            runtime.state === TaskState.Orphaned ||
            !!runtime.error ||
            (!!runtime.exitCode &&
                runtime.state !== TaskState.Shutdown &&
                runtime.state !== TaskState.Complete)
    )?.runtime
    const latestFailure = failure
        ? {
              taskId: failure.taskId,
              occurredAt: failure.stateChangedAt,
              error:
                  failure.error || failure.message || `Task ${failure.state}`,
          }
        : null

    return {
        status:
            desiredInstances === 0
                ? AppRuntimeStatus.Stopped
                : runningInstances.size >= desiredInstances
                  ? AppRuntimeStatus.Running
                  : AppRuntimeStatus.Degraded,
        desiredInstances,
        runningInstances: runningInstances.size,
        currentTasks: current.map(({ runtime }) => runtime),
        latestFailure,
        error: null,
        taskHistory: byStateTime
            .filter(({ runtime }) => historicalStates.has(runtime.state))
            .slice(0, HISTORY_LIMIT)
            .map(({ runtime }) => runtime),
    }
}
