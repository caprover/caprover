import configstore = require('configstore')
import AppsDataStore, {
    isNameAllowed,
} from '../src/datastore/AppsDataStore'
import { runDataStoreMigrations } from '../src/datastore/DataStore'
import { getAllAppDefinitions } from '../src/handlers/users/apps/appdefinition/AppDefinitionHandler'
import { IAppDef } from '../src/models/AppDefinition'
import {
    getLegacyServiceDnsAlias,
    getServiceNetworkAttachments,
} from '../src/docker/DockerApi'
import ServiceManager from '../src/user/ServiceManager'

function createConfigStore(initialData: { [key: string]: any }) {
    const data = { ...initialData }
    return {
        get: jest.fn((key: string) => data[key]),
        set: jest.fn((key: string, value: any) => {
            data[key] = value
        }),
    } as unknown as configstore
}

function createAppDefinition(overrides: Partial<IAppDef> = {}): IAppDef {
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
        networks: ['captain-overlay-network'],
        customDomain: [],
        ports: [],
        volumes: [],
        envVars: [],
        versions: [],
        ...overrides,
    }
}

describe('service and volume naming migration', () => {
    test('marks existing apps as legacy when schemaVersion is missing', () => {
        const appDefinitions = {
            existingApp: {},
        }
        const data = createConfigStore({ appDefinitions })

        runDataStoreMigrations(data)

        expect(appDefinitions.existingApp).toEqual({
            isLegacyAppName: true,
        })
        expect(data.set).toHaveBeenCalledWith('schemaVersion', 2)
    })

    test('does not mark apps created after schema version 2 as legacy', () => {
        const appDefinitions = {
            newApp: {},
        }
        const data = createConfigStore({
            schemaVersion: 2,
            appDefinitions,
        })

        runDataStoreMigrations(data)

        expect(appDefinitions.newApp).toEqual({})
        expect(data.set).not.toHaveBeenCalled()
    })

    test('returns an explicit legacy app name flag for every app', async () => {
        const dataStore = {
            getAppsDataStore: () => ({
                getAppDefinitions: jest.fn().mockResolvedValue({
                    legacyApp: createAppDefinition({
                        isLegacyAppName: true,
                    }),
                    modernApp: createAppDefinition(),
                }),
            }),
            getDefaultAppNginxConfig: jest.fn().mockResolvedValue(''),
            getRootDomain: jest.fn().mockReturnValue('example.com'),
        } as any
        const serviceManager = {
            isAppBuilding: jest.fn().mockReturnValue(false),
        } as any

        const result = await getAllAppDefinitions(dataStore, serviceManager)

        expect(result.data.appDefinitions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    appName: 'legacyApp',
                    isLegacyAppName: true,
                }),
                expect.objectContaining({
                    appName: 'modernApp',
                    isLegacyAppName: false,
                }),
            ])
        )
    })

    test('does not let saves override the legacy app name flag', async () => {
        const storedApp = createAppDefinition({ isLegacyAppName: true })
        const data = {
            get: jest.fn((key: string) => {
                if (key === 'appDefinitions.legacy-app') {
                    return storedApp
                }
                return undefined
            }),
            set: jest.fn(),
        } as unknown as configstore
        const appsDataStore = new AppsDataStore(data, 'captain')

        await (appsDataStore as any).saveApp(
            'legacy-app',
            createAppDefinition({ isLegacyAppName: false })
        )

        expect(data.set).toHaveBeenCalledWith(
            'appDefinitions.legacy-app',
            expect.objectContaining({ isLegacyAppName: true })
        )
    })

    test('does not let saves mark a modern app as legacy', async () => {
        const storedApp = createAppDefinition()
        const data = {
            get: jest.fn((key: string) => {
                if (key === 'appDefinitions.modern-app') {
                    return storedApp
                }
                return undefined
            }),
            set: jest.fn(),
        } as unknown as configstore
        const appsDataStore = new AppsDataStore(data, 'captain')

        await (appsDataStore as any).saveApp(
            'modern-app',
            createAppDefinition({ isLegacyAppName: true })
        )

        expect(data.set).toHaveBeenCalledWith(
            'appDefinitions.modern-app',
            expect.not.objectContaining({ isLegacyAppName: expect.anything() })
        )
    })

    test('reserves the captain service-name prefix', () => {
        expect(isNameAllowed('captain-nginx')).toBe(false)
        expect(isNameAllowed('captain-custom')).toBe(false)
        expect(isNameAllowed('my-app')).toBe(true)
    })

    test('keeps legacy and new physical volumes distinct during deletion', async () => {
        const appsDataStore = new AppsDataStore(
            createConfigStore({}),
            'captain'
        )
        jest.spyOn(appsDataStore, 'getAppDefinitions').mockResolvedValue({
            remainingLegacyApp: {
                isLegacyAppName: true,
                volumes: [
                    {
                        volumeName: 'data',
                        containerPath: '/data',
                    },
                ],
            } as any,
        })

        const deleteVols = jest.fn().mockResolvedValue([])
        const serviceManager = Object.create(
            ServiceManager.prototype
        ) as ServiceManager
        ;(serviceManager as any).dataStore = {
            getAppsDataStore: () => appsDataStore,
        }
        ;(serviceManager as any).dockerApi = {
            deleteVols,
        }

        const failedVolumes = await serviceManager.removeVolsSafe({
            'captain--data': 'data',
            data: 'data',
        })

        expect(deleteVols).toHaveBeenCalledWith(['data'])
        expect(failedVolumes).toEqual(['data'])
    })

    test('adds the legacy DNS alias to every network for a new app', () => {
        const alias = getLegacyServiceDnsAlias(
            'paperless-db',
            'captain',
            false
        )

        expect(
            getServiceNetworkAttachments(
                ['captain-overlay-network', 'private-network'],
                alias
            )
        ).toEqual([
            {
                Target: 'captain-overlay-network',
                Aliases: ['srv-captain--paperless-db'],
            },
            {
                Target: 'private-network',
                Aliases: ['srv-captain--paperless-db'],
            },
        ])
    })

    test('does not add a redundant DNS alias to legacy apps', () => {
        const alias = getLegacyServiceDnsAlias(
            'srv-captain--paperless-db',
            'captain',
            true
        )

        expect(
            getServiceNetworkAttachments(
                ['captain-overlay-network'],
                alias
            )
        ).toEqual([
            {
                Target: 'captain-overlay-network',
            },
        ])
    })

    test('deletes both physical volumes when neither remains in use', async () => {
        const appsDataStore = new AppsDataStore(
            createConfigStore({}),
            'captain'
        )
        jest.spyOn(appsDataStore, 'getAppDefinitions').mockResolvedValue({})

        const deleteVols = jest.fn().mockResolvedValue([])
        const serviceManager = Object.create(
            ServiceManager.prototype
        ) as ServiceManager
        ;(serviceManager as any).dataStore = {
            getAppsDataStore: () => appsDataStore,
        }
        ;(serviceManager as any).dockerApi = {
            deleteVols,
        }

        const failedVolumes = await serviceManager.removeVolsSafe({
            'captain--data': 'data',
            data: 'data',
        })

        expect(deleteVols).toHaveBeenCalledWith([
            'captain--data',
            'data',
        ])
        expect(failedVolumes).toEqual([])
    })
})
