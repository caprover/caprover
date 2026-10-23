import configstore = require('configstore')
import express = require('express')
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import ApiStatusCodes from '../src/api/ApiStatusCodes'
import AppsDataStore from '../src/datastore/AppsDataStore'
import DockerApi from '../src/docker/DockerApi'
import { getServiceRuntime } from '../src/docker/ServiceRuntime'
import type {
    DockerRuntimeNode,
    DockerRuntimeService,
    DockerRuntimeTask,
} from '../src/docker/ServiceRuntime'
import type { IAllAppDefinitions, IAppDef } from '../src/models/AppDefinition'
import { AppRuntimeStatus, TaskState } from '../src/models/AppRuntime'
import UserRouter from '../src/routes/user/UserRouter'
import Authenticator from '../src/user/Authenticator'
import ServiceManager from '../src/user/ServiceManager'
import CaptainConstants from '../src/utils/CaptainConstants'
import Logger from '../src/utils/Logger'

function service(name = 'website', replicas = 1): DockerRuntimeService {
    return {
        ID: `service-${name}`,
        Spec: {
            Name: name,
            Mode: { Replicated: { Replicas: replicas } },
            TaskTemplate: { ContainerSpec: { Env: ['SECRET=private'] } },
        },
    }
}

function task(overrides: Partial<DockerRuntimeTask> = {}): DockerRuntimeTask {
    return {
        ID: 'task-123',
        ServiceID: 'service-website',
        Slot: 1,
        NodeID: 'node-1',
        CreatedAt: '2026-10-23T00:59:40Z',
        DesiredState: TaskState.Running,
        Spec: { ContainerSpec: { Image: 'website:v8' } },
        Status: {
            State: TaskState.Running,
            Timestamp: '2026-10-23T00:59:50.123456789Z',
            Message: 'started',
            ContainerStatus: { ExitCode: 0 },
        },
        ...overrides,
    }
}

function appDefinition(overrides: Partial<IAppDef> = {}): IAppDef {
    return {
        description: '',
        deployedVersion: 0,
        notExposeAsWebApp: false,
        hasPersistentData: false,
        hasDefaultSubDomainSsl: false,
        captainDefinitionRelativeFilePath: './captain-definition',
        forceSsl: false,
        websocketSupport: false,
        instanceCount: 1,
        networks: [],
        customDomain: [],
        ports: [],
        volumes: [],
        envVars: [{ key: 'SECRET', value: 'private' }],
        versions: [],
        ...overrides,
    }
}

const nodes: DockerRuntimeNode[] = [
    { ID: 'node-1', Description: { Hostname: 'worker-1' } },
    { ID: 'node-2', Description: { Hostname: 'worker-2' } },
]

describe('service runtime normalization', () => {
    test('returns the running timestamp and only the public task fields', () => {
        const result = getServiceRuntime(service(), [task()], nodes)
        expect(result).toEqual({
            status: AppRuntimeStatus.Running,
            desiredInstances: 1,
            runningInstances: 1,
            currentTasks: [
                {
                    taskId: 'task-123',
                    slot: 1,
                    nodeId: 'node-1',
                    nodeName: 'worker-1',
                    image: 'website:v8',
                    state: TaskState.Running,
                    desiredState: TaskState.Running,
                    stateChangedAt: '2026-10-23T00:59:50.123456789Z',
                    message: 'started',
                    error: null,
                    exitCode: 0,
                },
            ],
            latestFailure: null,
            error: null,
            taskHistory: [],
        })
    })

    test.each([0, 1, 2])('reports %i/2 running replicas', (running) => {
        const tasks = Array.from({ length: running }, (_, index) =>
            task({ ID: `task-${index}`, Slot: index + 1 })
        )
        const result = getServiceRuntime(service('website', 2), tasks, nodes)
        expect(result.runningInstances).toBe(running)
        expect(result.status).toBe(
            running === 2 ? AppRuntimeStatus.Running : AppRuntimeStatus.Degraded
        )
    })

    test('keeps an allocated task visible while it is being scheduled', () => {
        const result = getServiceRuntime(
            service(),
            [task({ Status: { State: TaskState.Allocated } })],
            nodes
        )
        expect(result).toMatchObject({
            status: AppRuntimeStatus.Degraded,
            runningInstances: 0,
            currentTasks: [{ state: TaskState.Allocated }],
        })
    })

    test('keeps overlapping rollout tasks visible without counting a slot twice', () => {
        const tasks = [
            task({ ID: 'old', DesiredState: TaskState.Shutdown }),
            task({
                ID: 'replacement',
                CreatedAt: '2026-10-23T01:00:00Z',
            }),
            task({
                ID: 'starting-second-slot',
                Slot: 2,
                Status: { State: TaskState.Starting },
            }),
        ]
        const result = getServiceRuntime(service('website', 2), tasks, nodes)
        expect(result.currentTasks).toHaveLength(3)
        expect(result.runningInstances).toBe(1)
        expect(result.status).toBe(AppRuntimeStatus.Degraded)
        expect(result.taskHistory).toEqual([])
    })

    test('a running old task still supplies availability while its replacement starts', () => {
        const result = getServiceRuntime(
            service(),
            [
                task({ ID: 'old', DesiredState: TaskState.Shutdown }),
                task({
                    ID: 'new',
                    CreatedAt: '2026-10-23T01:00:00Z',
                    Status: { State: TaskState.Preparing },
                }),
            ],
            nodes
        )
        expect(result.status).toBe(AppRuntimeStatus.Running)
        expect(result.runningInstances).toBe(1)
    })

    test('reports intentional zero replicas as stopped', () => {
        const result = getServiceRuntime(service('website', 0), [], nodes)
        expect(result).toMatchObject({
            status: AppRuntimeStatus.Stopped,
            desiredInstances: 0,
            runningInstances: 0,
            currentTasks: [],
        })
    })

    test('returns failures in history and keeps recovered apps green', () => {
        const failed = task({
            ID: 'failed',
            DesiredState: TaskState.Shutdown,
            Status: {
                State: TaskState.Failed,
                Timestamp: '2026-10-23T00:59:45Z',
                Err: 'task: non-zero exit (1)',
                ContainerStatus: { ExitCode: 1 },
            },
        })
        const result = getServiceRuntime(service(), [failed, task()], nodes)
        expect(result.status).toBe(AppRuntimeStatus.Running)
        expect(result.currentTasks.map((task) => task.taskId)).toEqual([
            'task-123',
        ])
        expect(result.latestFailure).toEqual({
            taskId: 'failed',
            occurredAt: '2026-10-23T00:59:45Z',
            error: 'task: non-zero exit (1)',
        })
        expect(result.taskHistory[0].taskId).toBe('failed')
        const down = getServiceRuntime(service(), [failed], nodes)
        expect(down.runningInstances).toBe(0)
        expect(down.status).toBe(AppRuntimeStatus.Degraded)
        expect(down.taskHistory).toHaveLength(1)
    })

    test('does not report a normally stopped task as a failure', () => {
        const stopped = task({
            ID: 'stopped',
            DesiredState: TaskState.Shutdown,
            Status: {
                State: TaskState.Shutdown,
                Timestamp: '2026-10-23T00:59:45Z',
                ContainerStatus: { ExitCode: 143 },
            },
        })
        const result = getServiceRuntime(service(), [stopped, task()], nodes)
        expect(result.status).toBe(AppRuntimeStatus.Running)
        expect(result.latestFailure).toBeNull()
    })

    test('caps history at ten total across slots, newest first, including shutdowns', () => {
        const history = Array.from({ length: 25 }, (_, index) =>
            task({
                ID: `history-${index}`,
                Slot: (index % 2) + 1,
                DesiredState: TaskState.Shutdown,
                Status: {
                    State: TaskState.Shutdown,
                    Timestamp: new Date(
                        Date.UTC(2026, 9, 23, 0, 0, index)
                    ).toISOString(),
                },
            })
        )
        const result = getServiceRuntime(service(), history.reverse(), nodes)
        expect(result.currentTasks).toEqual([])
        expect(result.taskHistory.map((task) => task.taskId)).toEqual(
            Array.from({ length: 10 }, (_, index) => `history-${24 - index}`)
        )
        expect(result.latestFailure).toBeNull()
    })

    test('preserves missing node/container metadata and invalid times as null', () => {
        const result = getServiceRuntime(
            service(),
            [
                task({
                    NodeID: '',
                    Status: { State: TaskState.Pending, Timestamp: 'invalid' },
                }),
            ],
            []
        )
        expect(result.currentTasks[0]).toMatchObject({
            nodeId: null,
            nodeName: null,
            stateChangedAt: null,
            exitCode: null,
        })
        expect(result.status).toBe(AppRuntimeStatus.Degraded)
    })

    test('uses the Docker global target and node identities when slots are absent', () => {
        const globalService = service()
        globalService.Spec!.Mode = { Global: {} }
        globalService.ServiceStatus = {
            DesiredTasks: 2,
            RunningTasks: 2,
            CompletedTasks: 0,
        }
        const result = getServiceRuntime(
            globalService,
            [
                task({ Slot: 0 }),
                task({ ID: 'second', Slot: 0, NodeID: 'node-2' }),
            ],
            nodes
        )
        expect(result).toMatchObject({
            status: AppRuntimeStatus.Running,
            desiredInstances: 2,
            runningInstances: 2,
        })
    })

    test('marks an unknown target unavailable rather than treating it as zero', () => {
        const unsupportedService = service()
        unsupportedService.Spec!.Mode = {}
        expect(getServiceRuntime(unsupportedService, [], nodes)).toMatchObject({
            status: AppRuntimeStatus.Unavailable,
            desiredInstances: null,
            runningInstances: null,
        })
    })
})

describe('authenticated runtime routes through the real Docker client', () => {
    let engine: Server
    let server: Server
    let url: string
    let authorized: boolean
    let services: DockerRuntimeService[]
    let tasks: DockerRuntimeTask[]
    let definitions: IAllAppDefinitions
    let engineFailure: string | undefined
    let requests: URL[]

    beforeEach(async () => {
        authorized = true
        services = [service()]
        tasks = [task()]
        definitions = { website: appDefinition({ instanceCount: 7 }) }
        engineFailure = undefined
        requests = []
        jest.spyOn(Logger, 'e').mockImplementation()
        engine = createServer((req, res) => {
            const request = new URL(req.url!, 'http://localhost')
            requests.push(request)
            res.setHeader('Content-Type', 'application/json')
            const resource = request.pathname.split('/').pop()
            if (resource === engineFailure) {
                res.statusCode = 500
                res.end(
                    JSON.stringify({
                        message: 'private Docker connection details',
                    })
                )
                return
            }
            const data =
                resource === 'services'
                    ? services
                    : resource === 'tasks'
                      ? tasks
                      : nodes
            res.end(JSON.stringify(data))
        })
        await new Promise<void>((resolve) =>
            engine.listen(0, '127.0.0.1', resolve)
        )
        const dockerApi = new DockerApi({
            host: '127.0.0.1',
            port: (engine.address() as AddressInfo).port,
            version: 'v1.47',
            timeout: 1000,
        })
        const config = {
            get: (key: string) =>
                key === 'appDefinitions' ? definitions : undefined,
        } as unknown as configstore
        const appsDataStore = new AppsDataStore(config, 'captain')
        const manager = Object.assign(
            Object.create(ServiceManager.prototype) as ServiceManager,
            { dataStore: { getAppsDataStore: () => appsDataStore }, dockerApi }
        )

        const authenticator = new Authenticator(
            'runtime-test',
            CaptainConstants.rootNameSpace
        )
        jest.spyOn(authenticator, 'decodeAuthToken').mockRejectedValue(
            new Error('Missing auth token')
        )
        jest.spyOn(Authenticator, 'getAuthenticator').mockReturnValue(
            authenticator
        )
        const app = express()
        app.use((_req, res, next) => {
            if (authorized) {
                res.locals.user = {
                    initialized: true,
                    namespace: CaptainConstants.rootNameSpace,
                    serviceManager: manager,
                }
            }
            next()
        })
        app.use('/api/v2/user', UserRouter)
        server = await new Promise<Server>((resolve) => {
            const listening = app.listen(0, '127.0.0.1', () =>
                resolve(listening)
            )
        })
        url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v2/user/apps/runtime`
    })

    afterEach(async () => {
        await Promise.all(
            [engine, server].map(
                (server) =>
                    new Promise<void>((resolve, reject) => {
                        server.close((error) =>
                            error ? reject(error) : resolve()
                        )
                    })
            )
        )
        jest.restoreAllMocks()
    })

    test('returns the collection envelope and uses the applied target', async () => {
        const response = await fetch(url)
        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body).toMatchObject({
            status: ApiStatusCodes.STATUS_OK,
            description: 'App runtime information retrieved.',
            data: {
                apps: [
                    {
                        appName: 'website',
                        desiredInstances: 1,
                        runningInstances: 1,
                    },
                ],
            },
        })
        expect(body.data.apps[0]).not.toHaveProperty('taskHistory')
        expect(body.data.apps[0]).not.toHaveProperty('observedAt')
        expect(JSON.stringify(body)).not.toContain('SECRET')
        expect(requests).toHaveLength(3)
    })

    test('returns bounded single-app diagnostics using the same fields', async () => {
        tasks.push(
            ...Array.from({ length: 20 }, (_, index) =>
                task({
                    ID: `old-${index}`,
                    DesiredState: TaskState.Shutdown,
                    Status: {
                        State: TaskState.Failed,
                        Err: `exit ${index}`,
                        Timestamp: `2026-10-23T00:00:${String(index).padStart(2, '0')}Z`,
                    },
                })
            )
        )
        const response = await fetch(`${url}/website?historyLimit=999`)
        const body = await response.json()
        expect(body.status).toBe(ApiStatusCodes.STATUS_OK)
        expect(body.data.appName).toBe('website')
        expect(body.data.status).toBe(AppRuntimeStatus.Running)
        expect(body.data.taskHistory).toHaveLength(10)
        expect(body.data.latestFailure.error).toBe('exit 19')
        expect(body.data.taskHistory[0].taskId).toBe('old-19')
    })

    test('batches modern/legacy apps and excludes prefix matches and foreign tasks', async () => {
        definitions.legacy = appDefinition({ isLegacyAppName: true })
        services.push(service('srv-captain--legacy'), service('website-other'))
        tasks.push(
            task({
                ID: 'legacy-task',
                ServiceID: 'service-srv-captain--legacy',
            })
        )
        tasks.push(
            task({ ID: 'foreign-task', ServiceID: 'service-website-other' })
        )
        const body = await (await fetch(url)).json()
        expect(body.data.apps).toHaveLength(2)
        expect(body.data.apps[1]).toMatchObject({
            appName: 'legacy',
            status: AppRuntimeStatus.Running,
        })
        expect(JSON.stringify(body)).not.toContain('foreign-task')
        const servicesRequest = requests.find((request) =>
            request.pathname.endsWith('/services')
        )!
        expect(
            JSON.parse(servicesRequest.searchParams.get('filters')!)
        ).toEqual({ name: ['website', 'srv-captain--legacy'] })
        const tasksRequest = requests.find((request) =>
            request.pathname.endsWith('/tasks')
        )!
        expect(JSON.parse(tasksRequest.searchParams.get('filters')!)).toEqual({
            service: ['service-website', 'service-srv-captain--legacy'],
        })
        expect(requests).toHaveLength(3)
    })

    test.each(['services', 'tasks'])(
        'returns unavailable data on a %s lookup failure and recovers',
        async (resource) => {
            engineFailure = resource
            const body = await (await fetch(url)).json()
            expect(body.status).toBe(ApiStatusCodes.STATUS_OK)
            expect(body.data.apps[0]).toEqual({
                appName: 'website',
                status: AppRuntimeStatus.Unavailable,
                desiredInstances: null,
                runningInstances: null,
                currentTasks: [],
                latestFailure: null,
                error: 'Unable to retrieve app runtime',
            })
            expect(JSON.stringify(body)).not.toContain('private Docker')
            engineFailure = undefined
            const recovered = await (await fetch(url)).json()
            expect(recovered.data.apps[0].status).toBe(AppRuntimeStatus.Running)
        }
    )

    test('keeps runtime data when node-name lookup fails', async () => {
        engineFailure = 'nodes'
        const body = await (await fetch(url)).json()
        expect(body.data.apps[0]).toMatchObject({
            appName: 'website',
            status: AppRuntimeStatus.Running,
            desiredInstances: 1,
            runningInstances: 1,
            currentTasks: [{ nodeId: 'node-1', nodeName: null }],
            error: null,
        })
    })

    test('a missing Docker service does not hide the other apps', async () => {
        definitions.missing = appDefinition()
        const body = await (await fetch(url)).json()
        expect(body.data.apps[0].status).toBe(AppRuntimeStatus.Running)
        expect(body.data.apps[1]).toMatchObject({
            appName: 'missing',
            status: AppRuntimeStatus.Unavailable,
            error: 'Service not found',
        })
    })

    test('malformed task data only makes its own app unavailable', async () => {
        definitions.second = appDefinition()
        services.push(service('second'))
        tasks.push(
            task({
                ID: 'bad-task',
                ServiceID: 'service-second',
                Status: { State: 'unknown-state' },
            })
        )
        const body = await (await fetch(url)).json()
        expect(
            body.data.apps.map(
                (app: { status: AppRuntimeStatus }) => app.status
            )
        ).toEqual([AppRuntimeStatus.Running, AppRuntimeStatus.Unavailable])
    })

    test('empty installations do not query Docker', async () => {
        definitions = {}
        const body = await (await fetch(url)).json()
        expect(body.data).toEqual({ apps: [] })
        expect(requests).toEqual([])
    })

    test.each(['captain-nginx', '__proto__', 'toString', 'constructor'])(
        'rejects unowned app name %s before querying Docker',
        async (appName) => {
            const body = await (await fetch(`${url}/${appName}`)).json()
            expect(body.status).toBe(ApiStatusCodes.NOT_FOUND)
            expect(requests).toEqual([])
        }
    )

    test.each(['', '/website'])(
        'requires authentication for runtime%s',
        async (path) => {
            authorized = false
            const body = await (await fetch(url + path)).json()
            expect(body.status).toBe(ApiStatusCodes.STATUS_ERROR_NOT_AUTHORIZED)
            expect(requests).toEqual([])
        }
    )
})
