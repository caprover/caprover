import { getManagedVolumes } from '../src/handlers/users/system/VolumesHandler'
import { IAllAppDefinitions, IAppDef } from '../src/models/AppDefinition'

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

function createMockDataStore(namespace: string = 'captain') {
    return {
        getAppsDataStore: () => ({
            getVolumeName: (volumeName: string, isLegacy: boolean) => {
                if (isLegacy) {
                    return `${namespace}--${volumeName}`
                }

                return volumeName
            },
        }),
    } as any
}

describe('getManagedVolumes', () => {
    test('resolves modern and legacy Persistent Directories to physical volume names', () => {
        const apps: IAllAppDefinitions = {
            modernApp: createAppDefinition({
                volumes: [{ volumeName: 'app-data', containerPath: '/data' }],
            }),
            legacyApp: createAppDefinition({
                isLegacyAppName: true,
                volumes: [{ volumeName: 'app-data', containerPath: '/data' }],
            }),
        }

        expect(getManagedVolumes(apps, createMockDataStore('captain'))).toEqual(
            [
                { name: 'app-data', usedByAppNames: ['modernApp'] },
                {
                    name: 'captain--app-data',
                    usedByAppNames: ['legacyApp'],
                },
            ]
        )
    })

    test('groups a shared volume by all apps that use it', () => {
        const apps: IAllAppDefinitions = {
            secondApp: createAppDefinition({
                volumes: [{ volumeName: 'shared', containerPath: '/data' }],
            }),
            firstApp: createAppDefinition({
                volumes: [{ volumeName: 'shared', containerPath: '/data' }],
            }),
        }

        expect(getManagedVolumes(apps, createMockDataStore())).toEqual([
            {
                name: 'shared',
                usedByAppNames: ['firstApp', 'secondApp'],
            },
        ])
    })

    test('deduplicates an app that mounts the same volume more than once', () => {
        const apps: IAllAppDefinitions = {
            multiMountApp: createAppDefinition({
                volumes: [
                    { volumeName: 'shared', containerPath: '/one' },
                    { volumeName: 'shared', containerPath: '/two' },
                ],
            }),
        }

        expect(getManagedVolumes(apps, createMockDataStore())).toEqual([
            { name: 'shared', usedByAppNames: ['multiMountApp'] },
        ])
    })

    test('excludes bind-style Persistent Directories', () => {
        const apps: IAllAppDefinitions = {
            bindApp: createAppDefinition({
                volumes: [
                    { hostPath: '/host/path', containerPath: '/bind' },
                    { volumeName: 'named', containerPath: '/named' },
                ],
            }),
        }

        expect(getManagedVolumes(apps, createMockDataStore())).toEqual([
            { name: 'named', usedByAppNames: ['bindApp'] },
        ])
    })

    test('returns no volumes when there are no app definitions', () => {
        expect(getManagedVolumes({}, createMockDataStore())).toEqual([])
    })

    test('sorts managed volumes by physical name', () => {
        const apps: IAllAppDefinitions = {
            zetaApp: createAppDefinition({
                volumes: [{ volumeName: 'zeta', containerPath: '/data' }],
            }),
            alphaApp: createAppDefinition({
                volumes: [{ volumeName: 'alpha', containerPath: '/data' }],
            }),
            middleApp: createAppDefinition({
                volumes: [{ volumeName: 'middle', containerPath: '/data' }],
            }),
        }

        expect(
            getManagedVolumes(apps, createMockDataStore()).map((volume) =>
                volume.name
            )
        ).toEqual(['alpha', 'middle', 'zeta'])
    })
})
