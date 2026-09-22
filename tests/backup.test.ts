import {
    lstat,
    mkdtemp,
    readFile,
    readlink,
    rm,
    symlink,
    writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    copy,
    ensureDir,
    ensureFile,
    pathExists,
    readJson,
    removeSync,
} from 'fs-extra'
import { isDeepStrictEqual } from 'util'
import { RestoringInfo } from '../src/models/BackupMeta'
import BackupManager, {
    copyCaptainDataForBackup,
} from '../src/user/system/BackupManager'
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

describe('copyCaptainDataForBackup', () => {
    test('copies data contents without nesting and excludes shared logs', async () => {
        const root = await mkdtemp(join(tmpdir(), 'caprover-backup-copy-'))
        const source = join(root, 'source')
        const destination = join(root, 'destination')

        try {
            await ensureDir(join(source, 'shared-logs'))
            await writeFile(join(source, 'config-captain.json'), '{}')
            await writeFile(join(source, 'shared-logs', 'access.log'), 'log')
            await symlink(
                '/missing-certificate.pem',
                join(source, 'broken-certificate-link')
            )

            await copyCaptainDataForBackup(source, destination)

            expect(
                await readFile(join(destination, 'config-captain.json'), 'utf8')
            ).toBe('{}')
            expect(
                await pathExists(
                    join(destination, 'source', 'config-captain.json')
                )
            ).toBe(false)
            expect(await pathExists(join(destination, 'shared-logs'))).toBe(
                false
            )
            expect(
                (
                    await lstat(join(destination, 'broken-certificate-link'))
                ).isSymbolicLink()
            ).toBe(true)
            expect(
                await readlink(join(destination, 'broken-certificate-link'))
            ).toBe('/missing-certificate.pem')
        } finally {
            await rm(root, { recursive: true, force: true })
        }
    })

    test('rejects when the source copy fails', async () => {
        const root = await mkdtemp(join(tmpdir(), 'caprover-backup-copy-'))

        try {
            await expect(
                copyCaptainDataForBackup(
                    join(root, 'missing-source'),
                    join(root, 'destination')
                )
            ).rejects.toThrow()
        } finally {
            await rm(root, { recursive: true, force: true })
        }
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
