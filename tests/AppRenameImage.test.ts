/**
 * After an app is renamed, CapRover-built image tags must follow the new
 * app name. Otherwise creating a new app with the old name overwrites the
 * shared tag, and scaling the renamed app back up runs the wrong image.
 * See https://github.com/caprover/caprover/issues/2211
 */

import AppsDataStore from '../src/datastore/AppsDataStore'
import { IAppDef } from '../src/models/AppDefinition'
import { IRegistryTypes } from '../src/models/IRegistryInfo'
import Authenticator from '../src/user/Authenticator'
import BuildLog from '../src/user/BuildLog'
import DockerRegistryHelper from '../src/user/DockerRegistryHelper'
import ServiceManager from '../src/user/ServiceManager'
import { rewriteCapRoverBuiltImageName } from '../src/utils/BuiltImageName'
import Utils from '../src/utils/Utils'

function createConfigStore(initialData: { [key: string]: any }) {
    const data = JSON.parse(JSON.stringify(initialData))

    function getByPath(key: string) {
        return key.split('.').reduce((current: any, part: string) => {
            if (current == null) {
                return undefined
            }
            return current[part]
        }, data)
    }

    return {
        get: jest.fn((key: string) => getByPath(key)),
        set: jest.fn((key: string, value: any) => {
            const parts = key.split('.')
            let current = data
            for (let i = 0; i < parts.length - 1; i++) {
                if (
                    !current[parts[i]] ||
                    typeof current[parts[i]] !== 'object'
                ) {
                    current[parts[i]] = {}
                }
                current = current[parts[i]]
            }
            current[parts[parts.length - 1]] = value
        }),
        delete: jest.fn((key: string) => {
            const parts = key.split('.')
            let current = data
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) {
                    return
                }
                current = current[parts[i]]
            }
            delete current[parts[parts.length - 1]]
        }),
    }
}

function createDeployedApp(overrides: Partial<IAppDef> = {}): IAppDef {
    return {
        description: '',
        deployedVersion: 1,
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
        versions: [
            {
                version: 0,
                gitHash: 'aaa',
                timeStamp: '2024-01-01T00:00:00.000Z',
                deployedImageName: 'img-captain-app-1:0',
            },
            {
                version: 1,
                gitHash: 'bbb',
                timeStamp: '2024-01-02T00:00:00.000Z',
                deployedImageName: 'img-captain-app-1:1',
            },
        ],
        ...overrides,
    }
}

const authenticator = {
    getAppPushWebhookToken: jest.fn().mockResolvedValue('unused'),
} as unknown as Authenticator

describe('rewriteCapRoverBuiltImageName', () => {
    const namespace = 'captain'

    test('rewrites a local CapRover-built image tag', () => {
        expect(
            rewriteCapRoverBuiltImageName(
                'img-captain-app-1:1',
                namespace,
                'app-1',
                'app-2'
            )
        ).toBe('img-captain-app-2:1')
    })

    test('rewrites a self-hosted registry image tag', () => {
        expect(
            rewriteCapRoverBuiltImageName(
                'registry.example.com:996/captain/img-captain-app-1:1',
                namespace,
                'app-1',
                'app-2'
            )
        ).toBe('registry.example.com:996/captain/img-captain-app-2:1')
    })

    test('does not rewrite a third-party image', () => {
        expect(
            rewriteCapRoverBuiltImageName(
                'nginx:1.27',
                namespace,
                'app-1',
                'app-2'
            )
        ).toBe('nginx:1.27')
    })

    test('does not rewrite the placeholder image', () => {
        expect(
            rewriteCapRoverBuiltImageName(
                'caprover/caprover-placeholder-app:latest',
                namespace,
                'app-1',
                'app-2'
            )
        ).toBe('caprover/caprover-placeholder-app:latest')
    })

    test('does not rewrite a longer app name that shares a prefix', () => {
        expect(
            rewriteCapRoverBuiltImageName(
                'img-captain-app-10:1',
                namespace,
                'app-1',
                'app-2'
            )
        ).toBe('img-captain-app-10:1')
    })
})

describe('AppsDataStore.renameApp image names', () => {
    beforeEach(() => {
        jest.spyOn(Utils, 'getDelayedPromise').mockResolvedValue(undefined)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test('updates stored CapRover-built image tags when the app is renamed', async () => {
        const store = new AppsDataStore(
            createConfigStore({
                appDefinitions: {
                    'app-1': createDeployedApp(),
                },
            }) as any,
            'captain'
        )

        await store.renameApp(authenticator, 'app-1', 'app-2')

        await expect(store.getAppDefinition('app-1')).rejects.toThrow(
            'App (app-1) could not be found'
        )

        const renamed = await store.getAppDefinition('app-2')
        expect(
            renamed.versions.map((version) => version.deployedImageName)
        ).toEqual(['img-captain-app-2:0', 'img-captain-app-2:1'])
        expect(renamed.deployedVersion).toBe(1)
    })

    test('updates registry-prefixed image tags without touching third-party images', async () => {
        const store = new AppsDataStore(
            createConfigStore({
                appDefinitions: {
                    'app-1': createDeployedApp({
                        versions: [
                            {
                                version: 0,
                                gitHash: undefined,
                                timeStamp: '2024-01-01T00:00:00.000Z',
                                deployedImageName:
                                    'registry.example.com:996/captain/img-captain-app-1:0',
                            },
                            {
                                version: 1,
                                gitHash: undefined,
                                timeStamp: '2024-01-02T00:00:00.000Z',
                                deployedImageName: 'nginx:1.27',
                            },
                            {
                                version: 2,
                                gitHash: undefined,
                                timeStamp: '2024-01-03T00:00:00.000Z',
                            },
                        ],
                    }),
                },
            }) as any,
            'captain'
        )

        await store.renameApp(authenticator, 'app-1', 'app-2')

        const renamed = await store.getAppDefinition('app-2')
        expect(
            renamed.versions.map((version) => version.deployedImageName)
        ).toEqual([
            'registry.example.com:996/captain/img-captain-app-2:0',
            'nginx:1.27',
            undefined,
        ])
    })
})

describe('DockerRegistryHelper.retagAndPushImagesForAppRename', () => {
    function createHelper(dockerApi: any, registries: any[] = []) {
        const dataStore = {
            getRegistriesDataStore: () => ({
                getAllRegistries: jest.fn().mockResolvedValue(registries),
                getDefaultPushRegistryId: jest
                    .fn()
                    .mockResolvedValue(
                        registries[0] ? registries[0].id : undefined
                    ),
            }),
        }
        return new DockerRegistryHelper(dataStore as any, dockerApi)
    }

    const buildLogs = new BuildLog(10)

    test('retags local CapRover-built images and does not push them', async () => {
        const dockerApi = {
            retag: jest.fn().mockResolvedValue(undefined),
            pullImage: jest.fn().mockResolvedValue(undefined),
            pushImage: jest.fn().mockResolvedValue(undefined),
        }
        const helper = createHelper(dockerApi)

        await helper.retagAndPushImagesForAppRename(
            [
                {
                    version: 0,
                    gitHash: undefined,
                    timeStamp: '2024-01-01T00:00:00.000Z',
                    deployedImageName: 'img-captain-app-1:0',
                },
                {
                    version: 1,
                    gitHash: undefined,
                    timeStamp: '2024-01-02T00:00:00.000Z',
                    deployedImageName: 'img-captain-app-1:1',
                },
            ],
            'captain',
            'app-1',
            'app-2',
            buildLogs
        )

        expect(dockerApi.retag.mock.calls).toEqual([
            ['img-captain-app-1:0', 'img-captain-app-2:0'],
            ['img-captain-app-1:1', 'img-captain-app-2:1'],
        ])
        expect(dockerApi.pushImage).not.toHaveBeenCalled()
    })

    test('retags and pushes self-hosted registry images so swarm nodes can pull the new tag', async () => {
        const dockerApi = {
            retag: jest.fn().mockResolvedValue(undefined),
            pullImage: jest.fn().mockResolvedValue(undefined),
            pushImage: jest.fn().mockResolvedValue(undefined),
        }
        const helper = createHelper(dockerApi, [
            {
                id: 'local-reg',
                registryUser: 'captain',
                registryPassword: 'secret',
                registryDomain: 'registry.example.com:996',
                registryImagePrefix: 'captain',
                registryType: IRegistryTypes.LOCAL_REG,
            },
        ])

        await helper.retagAndPushImagesForAppRename(
            [
                {
                    version: 1,
                    gitHash: undefined,
                    timeStamp: '2024-01-02T00:00:00.000Z',
                    deployedImageName:
                        'registry.example.com:996/captain/img-captain-app-1:1',
                },
            ],
            'captain',
            'app-1',
            'app-2',
            buildLogs
        )

        expect(dockerApi.retag).toHaveBeenCalledWith(
            'registry.example.com:996/captain/img-captain-app-1:1',
            'registry.example.com:996/captain/img-captain-app-2:1'
        )
        expect(dockerApi.pushImage).toHaveBeenCalledTimes(1)
        expect(dockerApi.pushImage.mock.calls[0][0]).toBe(
            'registry.example.com:996/captain/img-captain-app-2:1'
        )
    })

    test('does not retag third-party or placeholder images', async () => {
        const dockerApi = {
            retag: jest.fn().mockResolvedValue(undefined),
            pullImage: jest.fn().mockResolvedValue(undefined),
            pushImage: jest.fn().mockResolvedValue(undefined),
        }
        const helper = createHelper(dockerApi)

        await helper.retagAndPushImagesForAppRename(
            [
                {
                    version: 0,
                    gitHash: undefined,
                    timeStamp: '2024-01-01T00:00:00.000Z',
                    deployedImageName: 'nginx:1.27',
                },
                {
                    version: 1,
                    gitHash: undefined,
                    timeStamp: '2024-01-02T00:00:00.000Z',
                    deployedImageName:
                        'caprover/caprover-placeholder-app:latest',
                },
            ],
            'captain',
            'app-1',
            'app-2',
            buildLogs
        )

        expect(dockerApi.retag).not.toHaveBeenCalled()
        expect(dockerApi.pushImage).not.toHaveBeenCalled()
    })

    test('pulls a missing local image from the registry then retags it', async () => {
        const dockerApi = {
            retag: jest
                .fn()
                .mockRejectedValueOnce(new Error('no such image'))
                .mockResolvedValueOnce(undefined),
            pullImage: jest.fn().mockResolvedValue(undefined),
            pushImage: jest.fn().mockResolvedValue(undefined),
        }
        const helper = createHelper(dockerApi, [
            {
                id: 'local-reg',
                registryUser: 'captain',
                registryPassword: 'secret',
                registryDomain: 'registry.example.com:996',
                registryImagePrefix: 'captain',
                registryType: IRegistryTypes.LOCAL_REG,
            },
        ])

        await helper.retagAndPushImagesForAppRename(
            [
                {
                    version: 1,
                    gitHash: undefined,
                    timeStamp: '2024-01-02T00:00:00.000Z',
                    deployedImageName:
                        'registry.example.com:996/captain/img-captain-app-1:1',
                },
            ],
            'captain',
            'app-1',
            'app-2',
            buildLogs
        )

        expect(dockerApi.pullImage).toHaveBeenCalledWith(
            'registry.example.com:996/captain/img-captain-app-1:1',
            expect.objectContaining({
                serveraddress: 'registry.example.com:996',
            })
        )
        expect(dockerApi.retag).toHaveBeenCalledTimes(2)
        expect(dockerApi.pushImage).toHaveBeenCalledTimes(1)
    })
})

describe('ServiceManager.renameApp', () => {
    test('retags images before removing the old service', async () => {
        const callOrder: string[] = []
        const dockerApi = {
            isServiceRunningByName: jest.fn().mockResolvedValue(true),
            removeServiceByName: jest.fn().mockImplementation(() => {
                callOrder.push('remove')
                return Promise.resolve()
            }),
            retag: jest.fn().mockImplementation(() => {
                callOrder.push('retag')
                return Promise.resolve()
            }),
            pullImage: jest.fn().mockResolvedValue(undefined),
            pushImage: jest.fn().mockResolvedValue(undefined),
        }
        const appsDataStore = {
            getAppDefinition: jest.fn().mockResolvedValue(createDeployedApp()),
            getServiceName: jest.fn().mockReturnValue('app-1'),
            nameAllowedOrThrow: jest.fn(),
            renameApp: jest.fn().mockResolvedValue(undefined),
        }
        const dataStore = {
            getAppsDataStore: () => appsDataStore,
            getNameSpace: () => 'captain',
            getRegistriesDataStore: () => ({
                getAllRegistries: jest.fn().mockResolvedValue([]),
                getDefaultPushRegistryId: jest
                    .fn()
                    .mockResolvedValue(undefined),
            }),
        }
        const serviceManager = new ServiceManager(
            dataStore as any,
            authenticator,
            dockerApi as any,
            { rePopulateNginxConfigFile: jest.fn() } as any,
            {} as any,
            {} as any
        )
        jest.spyOn(
            serviceManager,
            'ensureServiceInitedAndUpdated'
        ).mockResolvedValue(undefined as any)

        await serviceManager.renameApp('app-1', 'app-2')

        expect(dockerApi.retag.mock.calls).toEqual([
            ['img-captain-app-1:0', 'img-captain-app-2:0'],
            ['img-captain-app-1:1', 'img-captain-app-2:1'],
        ])
        expect(callOrder[0]).toBe('retag')
        expect(callOrder[callOrder.length - 1]).toBe('remove')
        expect(appsDataStore.renameApp).toHaveBeenCalledWith(
            authenticator,
            'app-1',
            'app-2'
        )
    })
})
