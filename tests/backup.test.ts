import { copy, ensureDir, ensureFile, readJson, removeSync } from 'fs-extra'
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

beforeEach(() => {
    return cleanup()
})

afterEach(() => {
    return cleanup()
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
