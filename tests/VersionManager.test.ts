import axios from 'axios'
import CaptainConstants from '../src/utils/CaptainConstants'
import DockerApi from '../src/docker/DockerApi'
import { getText } from '../src/utils/HttpUtils'
import DockerRegistryHelper from '../src/user/DockerRegistryHelper'
import VersionManager from '../src/user/system/VersionManager'

jest.mock('axios')
jest.mock('../src/docker/DockerApi', () => ({
    __esModule: true,
    default: {
        get: jest.fn(() => ({})),
    },
}))
jest.mock('../src/utils/HttpUtils', () => ({
    getText: jest.fn(),
}))
jest.mock('../src/utils/Logger', () => ({
    __esModule: true,
    default: {
        e: jest.fn(),
    },
}))

const mockedAxios = axios as jest.Mocked<typeof axios>
const mockedGetText = getText as jest.MockedFunction<typeof getText>

describe('VersionManager', () => {
    const originalImageName = CaptainConstants.configs.publishedNameOnDockerHub
    const originalVersion = CaptainConstants.configs.version
    const originalDebug = CaptainConstants.isDebug

    beforeEach(() => {
        jest.clearAllMocks()
        CaptainConstants.configs.publishedNameOnDockerHub = originalImageName
        CaptainConstants.configs.version = originalVersion
        CaptainConstants.isDebug = originalDebug
    })

    afterAll(() => {
        CaptainConstants.configs.publishedNameOnDockerHub = originalImageName
        CaptainConstants.configs.version = originalVersion
        CaptainConstants.isDebug = originalDebug
    })

    test('uses the official version API for standard CapRover installations', async () => {
        CaptainConstants.configs.publishedNameOnDockerHub = 'caprover/caprover'
        CaptainConstants.configs.version = '1.15.0'
        mockedAxios.get.mockResolvedValue({
            data: {
                status: 100,
                data: {
                    currentVersion: '1.15.0',
                    latestVersion: '1.15.4',
                    changeLogMessage: 'Release notes',
                    canUpdate: true,
                },
            },
        })

        await expect(
            new VersionManager().getCaptainImageTags()
        ).resolves.toEqual({
            currentVersion: '1.15.0',
            latestVersion: '1.15.4',
            changeLogMessage: 'Release notes',
            canUpdate: true,
        })

        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://api-v1.caprover.com/v2/versionInfo',
            { params: { currentVersion: '1.15.0' } }
        )
        expect(mockedGetText).not.toHaveBeenCalled()
    })

    test('fails safely when the official version API is unavailable', async () => {
        CaptainConstants.configs.publishedNameOnDockerHub = 'caprover/caprover'
        CaptainConstants.configs.version = '1.15.0'
        mockedAxios.get.mockRejectedValue(new Error('network failure'))

        await expect(
            new VersionManager().getCaptainImageTags()
        ).resolves.toEqual({
            currentVersion: '1.15.0',
            latestVersion: '1.15.0',
            changeLogMessage: '',
            canUpdate: false,
        })
    })

    test('reads custom image versions from Docker Hub and selects the highest tag', async () => {
        CaptainConstants.configs.publishedNameOnDockerHub = 'example/caprover'
        CaptainConstants.configs.version = '1.2.3'
        CaptainConstants.isDebug = false
        mockedGetText.mockResolvedValue(
            JSON.stringify({
                results: [
                    { name: '1.3.0' },
                    { name: 'invalid' },
                    { name: '2.0.0' },
                    { name: '1.9.0' },
                ],
            })
        )

        await expect(
            new VersionManager().getCaptainImageTags()
        ).resolves.toEqual({
            currentVersion: '1.2.3',
            latestVersion: '2.0.0',
            changeLogMessage: '',
            canUpdate: true,
        })
    })

    test('rejects an invalid Docker Hub response', async () => {
        CaptainConstants.configs.publishedNameOnDockerHub = 'example/caprover'
        CaptainConstants.isDebug = false
        mockedGetText.mockResolvedValue('invalid JSON')

        await expect(
            new VersionManager().getCaptainImageTags()
        ).rejects.toThrow('Received invalid JSON')
    })

    test('does not call Docker Hub in debug mode', async () => {
        CaptainConstants.configs.publishedNameOnDockerHub = 'captain-debug'
        CaptainConstants.configs.version = '0.0.0'
        CaptainConstants.isDebug = true

        await expect(
            new VersionManager().getCaptainImageTags()
        ).resolves.toEqual({
            currentVersion: '0.0.0',
            latestVersion: '0.0.0',
            changeLogMessage: '',
            canUpdate: false,
        })
        expect(mockedGetText).not.toHaveBeenCalled()
    })

    test('carries the server-provided minDockerApiVersion through the version info', async () => {
        CaptainConstants.configs.publishedNameOnDockerHub = 'caprover/caprover'
        CaptainConstants.configs.version = '1.15.4'
        mockedAxios.get.mockResolvedValue({
            data: {
                status: 100,
                data: {
                    currentVersion: '1.15.4',
                    latestVersion: '1.15.5',
                    changeLogMessage: '',
                    canUpdate: true,
                    minDockerApiVersion: 'v1.46',
                },
            },
        })

        await expect(
            new VersionManager().getCaptainImageTags()
        ).resolves.toEqual({
            currentVersion: '1.15.4',
            latestVersion: '1.15.5',
            changeLogMessage: '',
            canUpdate: true,
            minDockerApiVersion: 'v1.46',
        })
    })

    describe('updateCaptain', () => {
        const dockerApiMock = {
            hostDockerApiVersion: undefined as string | undefined,
            pullImage: jest.fn(),
            updateService: jest.fn(),
        }

        function createRegistryHelper(): DockerRegistryHelper {
            return {
                getDockerAuthObjectForImageName: jest.fn().mockResolvedValue({
                    serveraddress: '',
                    username: 'user',
                    password: 'pass',
                }),
            } as unknown as DockerRegistryHelper
        }

        function mockOfficialVersionApi(data: Record<string, unknown>): void {
            mockedAxios.get.mockResolvedValue({
                data: { status: 100, data: data },
            })
        }

        beforeEach(() => {
            dockerApiMock.hostDockerApiVersion = undefined
            dockerApiMock.pullImage.mockReset()
            dockerApiMock.pullImage.mockResolvedValue(undefined)
            dockerApiMock.updateService.mockReset()
            dockerApiMock.updateService.mockResolvedValue(undefined)
            ;(DockerApi.get as jest.Mock).mockReset()
            ;(DockerApi.get as jest.Mock).mockReturnValue(dockerApiMock)
        })

        test('rejects an update that requires a newer Docker API than the host supports', async () => {
            CaptainConstants.configs.publishedNameOnDockerHub =
                'caprover/caprover'
            CaptainConstants.configs.version = '1.13.3'
            // The official API does not provide minDockerApiVersion yet: the
            // per-release table decides the requirement.
            mockOfficialVersionApi({
                currentVersion: '1.13.3',
                latestVersion: '1.15.5',
                changeLogMessage: '',
                canUpdate: true,
            })
            dockerApiMock.hostDockerApiVersion = '1.43'

            await expect(
                new VersionManager().updateCaptain(
                    '1.15.5',
                    createRegistryHelper()
                )
            ).rejects.toThrow(
                'requires Docker API v1.44, but this host only supports Docker API 1.43'
            )
            expect(dockerApiMock.pullImage).not.toHaveBeenCalled()
            expect(dockerApiMock.updateService).not.toHaveBeenCalled()
        })

        test('allows an update when the host supports the required Docker API', async () => {
            CaptainConstants.configs.publishedNameOnDockerHub =
                'caprover/caprover'
            CaptainConstants.configs.version = '1.15.4'
            mockOfficialVersionApi({
                currentVersion: '1.15.4',
                latestVersion: '1.15.5',
                changeLogMessage: '',
                canUpdate: true,
            })
            dockerApiMock.hostDockerApiVersion = '1.44'

            const registryHelper = createRegistryHelper()

            await expect(
                new VersionManager().updateCaptain('1.15.5', registryHelper)
            ).resolves.toBeUndefined()
            expect(
                registryHelper.getDockerAuthObjectForImageName
            ).toHaveBeenCalledWith('caprover/caprover:1.15.5')
            expect(dockerApiMock.pullImage).toHaveBeenCalledWith(
                'caprover/caprover:1.15.5',
                { serveraddress: '', username: 'user', password: 'pass' }
            )
            expect(dockerApiMock.updateService).toHaveBeenCalledTimes(1)
        })

        test('skips the check when the host API version is not detected', async () => {
            CaptainConstants.configs.publishedNameOnDockerHub =
                'caprover/caprover'
            CaptainConstants.configs.version = '1.13.3'
            dockerApiMock.hostDockerApiVersion = undefined

            await expect(
                new VersionManager().updateCaptain(
                    '1.15.5',
                    createRegistryHelper()
                )
            ).resolves.toBeUndefined()
            // No requirement lookup is needed when there is nothing to compare against.
            expect(mockedAxios.get).not.toHaveBeenCalled()
            expect(dockerApiMock.pullImage).toHaveBeenCalledTimes(1)
        })

        test('uses the server-provided minDockerApiVersion for the offered release', async () => {
            CaptainConstants.configs.publishedNameOnDockerHub =
                'caprover/caprover'
            CaptainConstants.configs.version = '1.15.4'
            // Server requires a newer API than the per-release table knows about.
            mockOfficialVersionApi({
                currentVersion: '1.15.4',
                latestVersion: '1.15.5',
                changeLogMessage: '',
                canUpdate: true,
                minDockerApiVersion: 'v1.46',
            })
            dockerApiMock.hostDockerApiVersion = '1.44'

            await expect(
                new VersionManager().updateCaptain(
                    '1.15.5',
                    createRegistryHelper()
                )
            ).rejects.toThrow('requires Docker API v1.46')
            expect(dockerApiMock.pullImage).not.toHaveBeenCalled()
        })

        test('ignores the server-provided requirement for a different tag', async () => {
            CaptainConstants.configs.publishedNameOnDockerHub =
                'caprover/caprover'
            CaptainConstants.configs.version = '1.15.4'
            mockOfficialVersionApi({
                currentVersion: '1.15.4',
                latestVersion: '1.15.5',
                changeLogMessage: '',
                canUpdate: true,
                minDockerApiVersion: 'v1.46',
            })
            dockerApiMock.hostDockerApiVersion = '1.43'

            // 1.14.0 predates the v1.44 pin: the release table allows it.
            await expect(
                new VersionManager().updateCaptain(
                    '1.14.0',
                    createRegistryHelper()
                )
            ).resolves.toBeUndefined()
            expect(dockerApiMock.pullImage).toHaveBeenCalledTimes(1)
        })

        test('uses the release table for custom images without calling the official API', async () => {
            CaptainConstants.configs.publishedNameOnDockerHub =
                'example/caprover'
            CaptainConstants.configs.version = '1.13.3'
            dockerApiMock.hostDockerApiVersion = '1.43'

            await expect(
                new VersionManager().updateCaptain(
                    '1.15.5',
                    createRegistryHelper()
                )
            ).rejects.toThrow('requires Docker API v1.44')
            expect(mockedAxios.get).not.toHaveBeenCalled()
            expect(mockedGetText).not.toHaveBeenCalled()
            expect(dockerApiMock.pullImage).not.toHaveBeenCalled()
        })

        test('allows tags that predate the release table', async () => {
            CaptainConstants.configs.publishedNameOnDockerHub =
                'caprover/caprover'
            CaptainConstants.configs.version = '1.13.3'
            mockOfficialVersionApi({
                currentVersion: '1.13.3',
                latestVersion: '1.15.5',
                changeLogMessage: '',
                canUpdate: true,
            })
            dockerApiMock.hostDockerApiVersion = '1.43'

            await expect(
                new VersionManager().updateCaptain(
                    '1.7.9',
                    createRegistryHelper()
                )
            ).resolves.toBeUndefined()
            expect(dockerApiMock.pullImage).toHaveBeenCalledTimes(1)
        })
    })
})
