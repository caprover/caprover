import { patchAppDefinition } from '../src/handlers/users/apps/appdefinition/AppDefinitionHandler'
import DockerApi from '../src/docker/DockerApi'
import ServiceManager from '../src/user/ServiceManager'
import ApiStatusCodes from '../src/api/ApiStatusCodes'

/**
 * Turning persistent data on/off for an existing app.
 */

function makeApp(overrides: any = {}) {
    return {
        description: '',
        deployedVersion: 1,
        notExposeAsWebApp: false,
        hasPersistentData: false,
        hasDefaultSubDomainSsl: false,
        captainDefinitionRelativeFilePath: './captain-definition',
        forceSsl: false,
        websocketSupport: false,
        instanceCount: 2,
        networks: ['captain-overlay-network'],
        customDomain: [],
        ports: [],
        volumes: [],
        envVars: [],
        versions: [],
        ...overrides,
    } as any
}

function makeManager(app: any, nodes: string[], runningTaskNodeId: string) {
    const updateAppDefinitionInDb = jest.fn().mockResolvedValue(undefined)
    const appsDataStore = {
        getAppDefinition: jest.fn().mockResolvedValue(app),
        getServiceName: (appName: string) => `srv-captain--${appName}`,
        updateAppDefinitionInDb,
    }
    const dockerApi = {
        getNodesInfo: jest
            .fn()
            .mockResolvedValue(nodes.map((nodeId) => ({ nodeId }))),
        getNodeIdByServiceName: jest
            .fn()
            .mockImplementation(() =>
                runningTaskNodeId
                    ? Promise.resolve(runningTaskNodeId)
                    : Promise.reject(new Error('no task'))
            ),
        isServiceRunningByName: jest.fn().mockResolvedValue(true),
    }
    const manager = Object.assign(
        Object.create(ServiceManager.prototype) as ServiceManager,
        {
            dataStore: {
                getAppsDataStore: () => appsDataStore,
                getProjectsDataStore: () => ({}),
            },
            dockerApi,
            activeOrScheduledBuilds: {},
            authenticator: {},
        }
    )
    const ensureServiceInitedAndUpdated = jest.fn().mockResolvedValue(undefined)
    ;(manager as any).ensureServiceInitedAndUpdated =
        ensureServiceInitedAndUpdated

    return {
        manager,
        updateAppDefinitionInDb,
        ensureServiceInitedAndUpdated,
        dockerApi,
    }
}

function callUpdate(
    manager: ServiceManager,
    opts: {
        instanceCount?: number
        volumes?: any[]
        nodeId?: string
        hasPersistentData?: boolean
    }
) {
    return manager.updateAppDefinition(
        'my-app',
        '',
        '',
        opts.instanceCount ?? 2,
        '',
        [],
        opts.volumes ?? [],
        [],
        opts.nodeId ?? '',
        false,
        80,
        undefined as any,
        false,
        [],
        {} as any,
        '',
        '',
        '',
        '',
        false,
        { enabled: false },
        opts.hasPersistentData
    )
}

// updateAppDefinitionInDb positional args
const ARG_INSTANCE_COUNT = 3
const ARG_VOLUMES = 6
const ARG_NODE_ID = 8
const ARG_HAS_PERSISTENT_DATA = 22

describe('persistent data toggle on existing apps', () => {
    test('enabling on a single-node swarm pins to that node and forces 1 instance', async () => {
        const { manager, updateAppDefinitionInDb, dockerApi } = makeManager(
            makeApp(),
            ['node-only'],
            ''
        )

        await callUpdate(manager, {
            hasPersistentData: true,
            volumes: [{ containerPath: '/data', volumeName: 'my-data' }],
        })

        const args = updateAppDefinitionInDb.mock.calls[0]
        expect(args[ARG_NODE_ID]).toBe('node-only')
        expect(args[ARG_INSTANCE_COUNT]).toBe(1)
        expect(args[ARG_HAS_PERSISTENT_DATA]).toBe(true)
        expect(args[ARG_VOLUMES]).toHaveLength(1)
        expect(dockerApi.getNodeIdByServiceName).not.toHaveBeenCalled()
    })

    test('enabling on a multi-node swarm pins to the node of the running task', async () => {
        const { manager, updateAppDefinitionInDb } = makeManager(
            makeApp(),
            ['node-a', 'node-b'],
            'node-b'
        )

        await callUpdate(manager, { hasPersistentData: true })

        const args = updateAppDefinitionInDb.mock.calls[0]
        expect(args[ARG_NODE_ID]).toBe('node-b')
        expect(args[ARG_HAS_PERSISTENT_DATA]).toBe(true)
    })

    test('enabling on a multi-node swarm without a running task is refused', async () => {
        const {
            manager,
            updateAppDefinitionInDb,
            ensureServiceInitedAndUpdated,
        } = makeManager(makeApp(), ['node-a', 'node-b'], '')

        await expect(
            callUpdate(manager, { hasPersistentData: true })
        ).rejects.toMatchObject({
            captainErrorType: ApiStatusCodes.ILLEGAL_OPERATION,
        })
        expect(updateAppDefinitionInDb).not.toHaveBeenCalled()
        expect(ensureServiceInitedAndUpdated).not.toHaveBeenCalled()
    })

    test('disabling is refused while the app has volumes', async () => {
        const { manager, updateAppDefinitionInDb } = makeManager(
            makeApp({
                hasPersistentData: true,
                nodeId: 'node-a',
                volumes: [{ containerPath: '/data', volumeName: 'my-data' }],
            }),
            ['node-a'],
            'node-a'
        )

        await expect(
            callUpdate(manager, { hasPersistentData: false })
        ).rejects.toMatchObject({
            captainErrorType: ApiStatusCodes.ILLEGAL_OPERATION,
        })
        expect(updateAppDefinitionInDb).not.toHaveBeenCalled()
    })

    test('disabling without volumes removes the node pin', async () => {
        const { manager, updateAppDefinitionInDb } = makeManager(
            makeApp({ hasPersistentData: true, nodeId: 'node-a' }),
            ['node-a'],
            'node-a'
        )

        await callUpdate(manager, {
            hasPersistentData: false,
            nodeId: 'node-a',
        })

        const args = updateAppDefinitionInDb.mock.calls[0]
        expect(args[ARG_NODE_ID]).toBe('')
        expect(args[ARG_HAS_PERSISTENT_DATA]).toBe(false)
    })

    test('without the flag, a non-persistent app still rejects volumes', async () => {
        const { manager, updateAppDefinitionInDb } = makeManager(
            makeApp(),
            ['node-a'],
            'node-a'
        )

        await expect(
            callUpdate(manager, {
                volumes: [{ containerPath: '/data', volumeName: 'my-data' }],
            })
        ).rejects.toMatchObject({
            captainErrorType: ApiStatusCodes.ILLEGAL_OPERATION,
        })
        expect(updateAppDefinitionInDb).not.toHaveBeenCalled()
    })

    test('without the flag, the stored value is kept', async () => {
        const { manager, updateAppDefinitionInDb } = makeManager(
            makeApp({ hasPersistentData: true, nodeId: 'node-a' }),
            ['node-a'],
            'node-a'
        )

        await callUpdate(manager, { instanceCount: 1 })

        const args = updateAppDefinitionInDb.mock.calls[0]
        expect(args[ARG_NODE_ID]).toBe('node-a')
        expect(args[ARG_HAS_PERSISTENT_DATA]).toBe(true)
    })

    test('PATCH forwards hasPersistentData to the service manager', async () => {
        const existing = makeApp()
        const serviceManager = {
            updateAppDefinition: jest.fn().mockResolvedValue(undefined),
        } as any
        const dataStore = {
            getAppsDataStore: () => ({
                getAppDefinition: jest.fn().mockResolvedValue(existing),
            }),
        } as any

        await patchAppDefinition(
            'my-app',
            { hasPersistentData: true },
            dataStore,
            serviceManager
        )

        const args = serviceManager.updateAppDefinition.mock.calls[0]
        expect(args[21]).toBe(true)
    })
})

describe('DockerApi.updateService node pin', () => {
    async function runUpdate(nodeId: string | undefined, appObject: any) {
        const dockerApi = Object.create(DockerApi.prototype) as DockerApi
        const update = jest.fn().mockResolvedValue(undefined)
        ;(dockerApi as any).dockerode = {
            getService: jest.fn().mockReturnValue({
                inspect: jest.fn().mockResolvedValue({
                    Version: { Index: 1 },
                    Spec: {
                        TaskTemplate: {
                            ContainerSpec: { Image: 'img' },
                            Placement: {
                                Constraints: [
                                    'node.id == old-node',
                                    'node.role == worker',
                                ],
                            },
                        },
                        EndpointSpec: { Ports: [] },
                        Mode: { Replicated: { Replicas: 1 } },
                        Labels: {},
                    },
                }),
                update,
            }),
        }
        jest.spyOn(dockerApi, 'pruneContainers').mockResolvedValue(undefined)

        await dockerApi.updateService(
            'srv-captain--my-app',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            nodeId,
            undefined,
            undefined,
            appObject,
            undefined,
            undefined,
            undefined
        )

        return update.mock.calls[0][0].TaskTemplate.Placement.Constraints
    }

    test('an app without nodeId loses the stale node.id constraint', async () => {
        expect(await runUpdate('', makeApp())).toEqual(['node.role == worker'])
    })

    test('an app with nodeId is pinned to it', async () => {
        expect(await runUpdate('new-node', makeApp())).toEqual([
            'node.role == worker',
            'node.id == new-node',
        ])
    })

    test('non-app services without nodeId keep their constraints', async () => {
        expect(await runUpdate(undefined, undefined)).toEqual([
            'node.id == old-node',
            'node.role == worker',
        ])
    })
})
