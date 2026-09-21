import AppsDataStore from '../src/datastore/AppsDataStore'
import DockerApi from '../src/docker/DockerApi'

describe('custom port persistence', () => {
    test('preserves protocol and publishMode when updating an app definition', async () => {
        const appsDataStore = new AppsDataStore({} as any, 'captain')
        const existingApp = {
            description: '',
            deployedVersion: 0,
            notExposeAsWebApp: false,
            hasPersistentData: false,
            hasDefaultSubDomainSsl: false,
            captainDefinitionRelativeFilePath: './captain-definition',
            forceSsl: false,
            websocketSupport: false,
            instanceCount: 1,
            networks: ['captain-overlay-network'],
            customDomain: [],
            ports: [],
            volumes: [],
            envVars: [],
            versions: [],
        } as any

        jest.spyOn(appsDataStore, 'getAppDefinition').mockResolvedValue(
            existingApp
        )
        const saveApp = jest
            .fn()
            .mockResolvedValue(undefined)
        ;(appsDataStore as any).saveApp = saveApp

        const ports = [
            {
                containerPort: 3000,
                hostPort: 8000,
                protocol: 'tcp' as const,
                publishMode: 'host' as const,
            },
            {
                containerPort: 3001,
                hostPort: 8001,
                protocol: 'udp' as const,
                publishMode: 'ingress' as const,
            },
            {
                containerPort: 3002,
                hostPort: 8002,
            },
        ]

        await appsDataStore.updateAppDefinitionInDb(
            'test-app',
            undefined,
            '',
            1,
            './captain-definition',
            [],
            [],
            [],
            '',
            false,
            80,
            undefined,
            false,
            ports,
            undefined as any,
            {} as any,
            '',
            '',
            '',
            '',
            false,
            { enabled: false }
        )

        expect(saveApp).toHaveBeenCalledWith(
            'test-app',
            expect.objectContaining({
                ports: [
                    {
                        containerPort: 3000,
                        hostPort: 8000,
                        protocol: 'tcp',
                        publishMode: 'host',
                    },
                    {
                        containerPort: 3001,
                        hostPort: 8001,
                        protocol: 'udp',
                        publishMode: 'ingress',
                    },
                    {
                        containerPort: 3002,
                        hostPort: 8002,
                    },
                ],
            })
        )
    })

    test('creates Docker port mappings with protocol and publish mode intact', async () => {
        const dockerApi = new DockerApi({} as any)
        const createService = jest.fn().mockResolvedValue({})
        ;(dockerApi as any).dockerode = { createService }

        await dockerApi.createServiceOnNodeId(
            'nginx:latest',
            'test-service',
            [
                {
                    containerPort: 3000,
                    hostPort: 8000,
                    protocol: 'tcp',
                    publishMode: 'host',
                },
                {
                    containerPort: 3001,
                    hostPort: 8001,
                    protocol: 'udp',
                    publishMode: 'ingress',
                },
                {
                    containerPort: 3002,
                    hostPort: 8002,
                    publishMode: 'host',
                },
                {
                    containerPort: 3003,
                    hostPort: 8003,
                    protocol: 'tcp',
                },
            ],
            undefined,
            undefined,
            undefined
        )

        expect(createService).toHaveBeenCalledWith(
            expect.objectContaining({
                EndpointSpec: {
                    Ports: [
                        {
                            Protocol: 'tcp',
                            TargetPort: 3000,
                            PublishedPort: 8000,
                            PublishMode: 'host',
                        },
                        {
                            Protocol: 'udp',
                            TargetPort: 3001,
                            PublishedPort: 8001,
                            PublishMode: 'ingress',
                        },
                        {
                            Protocol: 'tcp',
                            TargetPort: 3002,
                            PublishedPort: 8002,
                            PublishMode: 'host',
                        },
                        {
                            Protocol: 'udp',
                            TargetPort: 3002,
                            PublishedPort: 8002,
                            PublishMode: 'host',
                        },
                        {
                            Protocol: 'tcp',
                            TargetPort: 3003,
                            PublishedPort: 8003,
                        },
                    ],
                },
            })
        )
    })

    test('updates Docker port mappings with protocol and publish mode intact', async () => {
        jest.useFakeTimers()

        const dockerApi = new DockerApi({} as any)
        const update = jest.fn().mockResolvedValue({})
        const service = {
            inspect: jest.fn().mockResolvedValue({
                Version: { Index: 1 },
                Spec: {
                    TaskTemplate: {
                        ContainerSpec: {},
                        Placement: { Constraints: [] },
                    },
                    EndpointSpec: { Ports: [] },
                    Mode: { Replicated: { Replicas: 1 } },
                    Labels: {},
                },
            }),
            update,
        }
        ;(dockerApi as any).dockerode = {
            getService: jest.fn().mockReturnValue(service),
        }
        jest.spyOn(dockerApi, 'pruneContainers').mockResolvedValue(undefined)

        await dockerApi.updateService(
            'test-service',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            [
                {
                    containerPort: 3000,
                    hostPort: 8000,
                    protocol: 'tcp',
                    publishMode: 'host',
                },
                {
                    containerPort: 3001,
                    hostPort: 8001,
                    protocol: 'udp',
                    publishMode: 'ingress',
                },
                {
                    containerPort: 3002,
                    hostPort: 8002,
                    publishMode: 'host',
                },
                {
                    containerPort: 3003,
                    hostPort: 8003,
                    protocol: 'tcp',
                },
            ],
            undefined,
            undefined,
            undefined,
            undefined
        )

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                EndpointSpec: {
                    Ports: [
                        {
                            Protocol: 'tcp',
                            TargetPort: 3000,
                            PublishedPort: 8000,
                            PublishMode: 'host',
                        },
                        {
                            Protocol: 'udp',
                            TargetPort: 3001,
                            PublishedPort: 8001,
                            PublishMode: 'ingress',
                        },
                        {
                            Protocol: 'tcp',
                            TargetPort: 3002,
                            PublishedPort: 8002,
                            PublishMode: 'host',
                        },
                        {
                            Protocol: 'udp',
                            TargetPort: 3002,
                            PublishedPort: 8002,
                            PublishMode: 'host',
                        },
                        {
                            Protocol: 'tcp',
                            TargetPort: 3003,
                            PublishedPort: 8003,
                        },
                    ],
                },
            })
        )

        jest.runOnlyPendingTimers()
        jest.useRealTimers()
    })
})
