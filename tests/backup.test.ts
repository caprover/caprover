import {
    copy,
    ensureDir,
    ensureFile,
    outputJson,
    pathExists,
    readJson,
    remove,
    removeSync,
} from 'fs-extra'
import * as tar from 'tar'
import { isDeepStrictEqual } from 'util'
import { RestoringInfo } from '../src/models/BackupMeta'
import BackupManager from '../src/user/system/BackupManager'
import CaptainConstants from '../src/utils/CaptainConstants'
const BACKUP_FILE_PATH_ABSOLUTE = '/captain/backup.tar'

function cleanup() {
    return Promise.resolve()
        .then(function () {
            return ensureFile(BACKUP_FILE_PATH_ABSOLUTE)
        })
        .then(function () {
            return removeSync(BACKUP_FILE_PATH_ABSOLUTE)
        })
        .then(function () {
            return ensureDir(CaptainConstants.restoreDirectoryPath)
        })
        .then(function () {
            return removeSync(CaptainConstants.restoreDirectoryPath)
        })
}

if (process.env.CI) {
    beforeEach(() => {
        return cleanup()
    })

    afterEach(() => {
        return cleanup()
    })
}

describe('BackupManager.sanitizeHostnameForFilename', () => {
    test('returns the hostname unchanged when it only contains safe chars', () => {
        expect(
            BackupManager.sanitizeHostnameForFilename('captain-prod.example.com')
        ).toBe('captain-prod.example.com')
    })

    test('replaces filesystem-unsafe characters with underscores', () => {
        expect(
            BackupManager.sanitizeHostnameForFilename('host/with bad?chars')
        ).toBe('host_with_bad_chars')
    })

    test('returns an empty string for an empty hostname', () => {
        expect(BackupManager.sanitizeHostnameForFilename('')).toBe('')
    })

    test('returns an empty string for an undefined hostname', () => {
        expect(BackupManager.sanitizeHostnameForFilename(undefined)).toBe('')
    })
})

if (process.env.CI) {
    describe('backup tests [CI only]', backupTests)
} else {
    describe.skip('backup tests [CI only]', backupTests)
}

function backupTests() {
    test('No backup file', () => {
        const bk = new BackupManager()
        return Promise.resolve()
            .then(function () {
                return bk.checkAndPrepareRestoration()
            })
            .then(function (data) {
                expect(data).toBeFalsy()
            })
    })

    test('Restores malformed backup with nested data/data layout', async () => {
        const sourceDirectory = '/tmp/caprover-malformed-backup-test'
        const malformedDataDirectory = `${sourceDirectory}/data/data`

        await remove(sourceDirectory)

        try {
            await outputJson(`${sourceDirectory}/meta/backup.json`, {
                salt: 'test-salt',
                nodes: [
                    {
                        nodeId: '123456789',
                        type: 'manager',
                        isLeader: true,
                        hostname: 'test',
                        architecture: 'x86_64',
                        operatingSystem: 'linux',
                        nanoCpu: 8000000000,
                        memoryBytes: 8241434624,
                        dockerEngineVersion: '18.09.2',
                        ip: '123.123.123.123',
                        state: 'ready',
                        status: 'active',
                    },
                ],
            })
            await outputJson(`${malformedDataDirectory}/config-captain.json`, {
                appDefinitions: {
                    pers1: {
                        nodeId: '123456789',
                    },
                },
            })
            await ensureDir(`${malformedDataDirectory}/shared-logs`)
            await outputJson(
                `${malformedDataDirectory}/shared-logs/should-not-restore.json`,
                { ignored: true }
            )

            await tar.c(
                {
                    file: BACKUP_FILE_PATH_ABSOLUTE,
                    cwd: sourceDirectory,
                },
                ['./']
            )

            const bk = new BackupManager()
            await bk.checkAndPrepareRestoration()

            expect(
                await pathExists(
                    `${CaptainConstants.restoreDirectoryPath}/data/config-captain.json`
                )
            ).toBe(true)
            expect(
                await pathExists(
                    `${CaptainConstants.restoreDirectoryPath}/data/data/config-captain.json`
                )
            ).toBe(false)
            expect(
                await pathExists(
                    `${CaptainConstants.restoreDirectoryPath}/data/shared-logs`
                )
            ).toBe(false)

            const ret = (await readJson(
                CaptainConstants.restoreDirectoryPath +
                    '/restore-instructions.json'
            )) as RestoringInfo

            expect(ret.nodesMapping).toEqual([
                {
                    newIp: 'CURRENT_NODE_DONT_CHANGE',
                    oldIp: '123.123.123.123',
                    privateKeyPath: '',
                    user: '',
                },
            ])
            expect(ret.oldNodesForReference[0].appsLockOnThisNode).toEqual([
                'pers1',
            ])
        } finally {
            await remove(sourceDirectory)
        }
    })

    test('Test backup file', () => {
        const bk = new BackupManager()
        return Promise.resolve()
            .then(function () {
                return copy(
                    `${__dirname}/backup.tar`,
                    BACKUP_FILE_PATH_ABSOLUTE
                )
            })
            .then(function () {
                return bk.checkAndPrepareRestoration()
            })
            .then(function () {
                return readJson(
                    CaptainConstants.restoreDirectoryPath +
                        '/restore-instructions.json'
                )
            })
            .then(function (ret: RestoringInfo) {
                const expectedValue = {
                    nodesMapping: [
                        {
                            newIp: 'CURRENT_NODE_DONT_CHANGE',
                            oldIp: '123.123.123.123',
                            privateKeyPath: '',
                            user: '',
                        },
                    ],
                    oldNodesForReference: [
                        {
                            nodeData: {
                                nodeId: '123456789',
                                type: 'manager',
                                isLeader: true,
                                hostname: 'test',
                                architecture: 'x86_64',
                                operatingSystem: 'linux',
                                nanoCpu: 8000000000,
                                memoryBytes: 8241434624,
                                dockerEngineVersion: '18.09.2',
                                ip: '123.123.123.123',
                                state: 'ready',
                                status: 'active',
                            },
                            appsLockOnThisNode: ['pers1'],
                        },
                    ],
                }
                expect(isDeepStrictEqual(ret, expectedValue)).toBe(true)
                ret.nodesMapping[0].oldIp += ' '
                expect(isDeepStrictEqual(ret, expectedValue)).toBe(false)
            })
    })
}
