import BackupManager from '../src/user/system/BackupManager'
import { fstat, copy, ensureFile, removeSync } from 'fs-extra'
import Utils from '../src/utils/Utils'
const BACKUP_FILE_PATH_ABSOLUTE = '/captain/backup.tar'

beforeEach(() => {
    return ensureFile(BACKUP_FILE_PATH_ABSOLUTE).then(function() {
        return removeSync(BACKUP_FILE_PATH_ABSOLUTE)
    })
})

test('No backup file', () => {
    const bk = new BackupManager()
    return Promise.resolve()
        .then(function() {
            return bk.checkAndPrepareRestoration()
        })
        .then(function(data) {
            expect(data).toBeFalsy()
        })
})

test('Test backup file', () => {
    const bk = new BackupManager()
    return Promise.resolve()
        .then(function() {
            return copy(`${__dirname}/backup.tar`, BACKUP_FILE_PATH_ABSOLUTE)
        })
        .then(function() {
            return bk.checkAndPrepareRestoration()
        })
        .then(function(data) {
            expect(data).toBe(true)
        })
})
