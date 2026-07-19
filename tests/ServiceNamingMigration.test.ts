import configstore = require('configstore')
import AppsDataStore, {
    isNameAllowed,
} from '../src/datastore/AppsDataStore'
import { runDataStoreMigrations } from '../src/datastore/DataStore'
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

    test('preserves existing aliases when rebuilding network attachments', () => {
        expect(
            getServiceNetworkAttachments(
                ['network-a', 'network-b', 'network-c'],
                undefined,
                [
                    {
                        Target: 'network-a',
                        Aliases: ['alias-a'],
                    },
                    {
                        Target: 'network-b',
                        Aliases: ['alias-b'],
                    },
                ]
            )
        ).toEqual([
            {
                Target: 'network-a',
                Aliases: ['alias-a'],
            },
            {
                Target: 'network-b',
                Aliases: ['alias-b'],
            },
            {
                Target: 'network-c',
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

    test('rejects a legacy DNS alias that conflicts with an orphaned service', async () => {
        const serviceManager = Object.create(
            ServiceManager.prototype
        ) as ServiceManager
        ;(serviceManager as any).dataStore = {
            getAppsDataStore: () => ({
                getServiceName: () => 'srv-captain--paperless-db',
            }),
        }
        ;(serviceManager as any).dockerApi = {
            isServiceRunningByName: jest.fn().mockResolvedValue(true),
        }

        await expect(
            serviceManager.ensureLegacyServiceNameAvailable('paperless-db')
        ).rejects.toThrow(
            'A Docker service named srv-captain--paperless-db already exists'
        )
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
