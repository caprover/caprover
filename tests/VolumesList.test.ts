import {
    DockerVolumeInfo,
    mapVolumeInspectToDto,
    VolumeInspectWithCreatedAt,
} from '../src/docker/DockerApi'
import {
    enrichVolumesWithAppUsage,
    isLikelySystemVolumeName,
    sortVolumesByName,
    VolumeListItem,
} from '../src/handlers/users/system/VolumesHandler'
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

function baseVolume(
    overrides: Partial<DockerVolumeInfo> = {}
): DockerVolumeInfo {
    return {
        name: 'my-data',
        driver: 'local',
        mountpoint: '/var/lib/docker/volumes/my-data/_data',
        scope: 'local',
        labels: {},
        options: null,
        ...overrides,
    }
}

describe('mapVolumeInspectToDto', () => {
    test('maps required fields and coerces null Labels to {}', () => {
        const inspect = {
            Name: 'vol-a',
            Driver: 'local',
            Mountpoint: '/var/lib/docker/volumes/vol-a/_data',
            Scope: 'local',
            Labels: null,
            Options: null,
        } as unknown as VolumeInspectWithCreatedAt

        expect(mapVolumeInspectToDto(inspect)).toEqual({
            name: 'vol-a',
            driver: 'local',
            mountpoint: '/var/lib/docker/volumes/vol-a/_data',
            scope: 'local',
            labels: {},
            options: null,
        })
    })

    test('maps UsageData and CreatedAt only when present', () => {
        const inspect = {
            Name: 'vol-b',
            Driver: 'local',
            Mountpoint: '/mp',
            Scope: 'local',
            Labels: { a: 'b' },
            Options: { device: 'tmpfs' },
            UsageData: { Size: 1024, RefCount: 2 },
            CreatedAt: '2024-01-15T12:34:56Z',
        } as VolumeInspectWithCreatedAt

        expect(mapVolumeInspectToDto(inspect)).toEqual({
            name: 'vol-b',
            driver: 'local',
            mountpoint: '/mp',
            scope: 'local',
            labels: { a: 'b' },
            options: { device: 'tmpfs' },
            size: 1024,
            refCount: 2,
            createdAt: '2024-01-15T12:34:56Z',
        })
    })

    test('omits size/refCount when UsageData is missing (typical listVolumes)', () => {
        const inspect = {
            Name: 'vol-c',
            Driver: 'local',
            Mountpoint: '/mp',
            Scope: 'local',
            Labels: {},
            Options: null,
        } as VolumeInspectWithCreatedAt

        const dto = mapVolumeInspectToDto(inspect)
        expect(dto.size).toBeUndefined()
        expect(dto.refCount).toBeUndefined()
        expect(dto.createdAt).toBeUndefined()
    })
})

describe('isLikelySystemVolumeName', () => {
    test('flags reserved exact names and known CapRover services', () => {
        expect(isLikelySystemVolumeName('captain')).toBe(true)
        expect(isLikelySystemVolumeName('registry')).toBe(true)
        expect(isLikelySystemVolumeName('captain-nginx')).toBe(true)
        expect(isLikelySystemVolumeName('captain-certbot')).toBe(true)
        expect(isLikelySystemVolumeName('captain-registry')).toBe(true)
        expect(isLikelySystemVolumeName('captain-captain')).toBe(true)
        expect(isLikelySystemVolumeName('captain-goaccess-container')).toBe(
            true
        )
        expect(isLikelySystemVolumeName('captain-netdata-container')).toBe(
            true
        )
    })

    test('flags namespace prefix including legacy physical volumes', () => {
        // Legacy physical: captain--data starts with captain-
        expect(isLikelySystemVolumeName('captain--legacy-app-data')).toBe(true)
        expect(isLikelySystemVolumeName('captain-something')).toBe(true)
    })

    test('does not flag ordinary user volume names', () => {
        expect(isLikelySystemVolumeName('my-postgres-data')).toBe(false)
        expect(isLikelySystemVolumeName('app-data')).toBe(false)
        expect(isLikelySystemVolumeName('')).toBe(false)
    })

    test('respects custom namespace prefix while keeping known CapRover names', () => {
        expect(isLikelySystemVolumeName('customns-nginx', 'customns')).toBe(
            true
        )
        expect(isLikelySystemVolumeName('customns--data', 'customns')).toBe(
            true
        )
        // Ordinary name without custom prefix is not system-like
        expect(isLikelySystemVolumeName('my-data', 'customns')).toBe(false)
        // Known CapRover service names always match (defense in depth)
        expect(isLikelySystemVolumeName('captain-nginx', 'customns')).toBe(
            true
        )
    })
})

describe('enrichVolumesWithAppUsage', () => {
    test('maps modern and legacy physical names to usedByAppNames', () => {
        const apps: IAllAppDefinitions = {
            modernApp: createAppDefinition({
                volumes: [
                    {
                        volumeName: 'app-data',
                        containerPath: '/data',
                    },
                ],
            }),
            legacyApp: createAppDefinition({
                isLegacyAppName: true,
                volumes: [
                    {
                        volumeName: 'app-data',
                        containerPath: '/data',
                    },
                ],
            }),
        }

        const volumes = [
            baseVolume({ name: 'app-data' }),
            baseVolume({ name: 'captain--app-data' }),
            baseVolume({ name: 'orphan-vol' }),
        ]

        const result = enrichVolumesWithAppUsage(
            volumes,
            apps,
            createMockDataStore('captain'),
            'captain'
        )

        const byName = Object.fromEntries(result.map((v) => [v.name, v]))

        expect(byName['app-data'].usedByAppNames).toEqual(['modernApp'])
        expect(byName['captain--app-data'].usedByAppNames).toEqual([
            'legacyApp',
        ])
        expect(byName['orphan-vol'].usedByAppNames).toEqual([])
        expect(byName['app-data'].isLikelySystem).toBe(false)
        expect(byName['captain--app-data'].isLikelySystem).toBe(true)
        expect(byName['orphan-vol'].isLikelySystem).toBe(false)
    })

    test('skips bind-style Persistent Directories (hostPath only)', () => {
        const apps: IAllAppDefinitions = {
            bindApp: createAppDefinition({
                volumes: [
                    {
                        hostPath: '/host/path',
                        containerPath: '/data',
                    },
                    {
                        volumeName: 'named-vol',
                        containerPath: '/named',
                    },
                ],
            }),
        }

        const volumes = [
            baseVolume({ name: 'named-vol' }),
            baseVolume({ name: 'unrelated' }),
        ]

        const result = enrichVolumesWithAppUsage(
            volumes,
            apps,
            createMockDataStore(),
            'captain'
        )

        expect(
            result.find((v) => v.name === 'named-vol')!.usedByAppNames
        ).toEqual(['bindApp'])
        expect(
            result.find((v) => v.name === 'unrelated')!.usedByAppNames
        ).toEqual([])
    })

    test('dedupes app names when an app references the same volume twice', () => {
        const apps: IAllAppDefinitions = {
            multiMount: createAppDefinition({
                volumes: [
                    { volumeName: 'shared', containerPath: '/a' },
                    { volumeName: 'shared', containerPath: '/b' },
                ],
            }),
            otherApp: createAppDefinition({
                volumes: [{ volumeName: 'shared', containerPath: '/c' }],
            }),
        }

        const result = enrichVolumesWithAppUsage(
            [baseVolume({ name: 'shared' })],
            apps,
            createMockDataStore(),
            'captain'
        )

        expect(result[0].usedByAppNames.sort()).toEqual([
            'multiMount',
            'otherApp',
        ])
    })

    test('returns empty usedByAppNames for empty volume list', () => {
        const apps: IAllAppDefinitions = {
            someApp: createAppDefinition({
                volumes: [{ volumeName: 'x', containerPath: '/x' }],
            }),
        }

        expect(
            enrichVolumesWithAppUsage(
                [],
                apps,
                createMockDataStore(),
                'captain'
            )
        ).toEqual([])
    })
})

describe('sortVolumesByName', () => {
    test('sorts by name ascending without mutating input', () => {
        const input: VolumeListItem[] = [
            {
                ...baseVolume({ name: 'zeta' }),
                usedByAppNames: [],
                isLikelySystem: false,
            },
            {
                ...baseVolume({ name: 'alpha' }),
                usedByAppNames: [],
                isLikelySystem: false,
            },
            {
                ...baseVolume({ name: 'middle' }),
                usedByAppNames: [],
                isLikelySystem: false,
            },
        ]
        const originalOrder = input.map((v) => v.name)

        const sorted = sortVolumesByName(input)

        expect(sorted.map((v) => v.name)).toEqual([
            'alpha',
            'middle',
            'zeta',
        ])
        expect(input.map((v) => v.name)).toEqual(originalOrder)
    })
})
