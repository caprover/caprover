import BackupManager from '../src/user/system/BackupManager'
import * as CaptainConstants from '../src/utils/CaptainConstants'
import { fstat, copy, ensureFile, removeSync, ensureDir } from 'fs-extra'
import Utils from '../src/utils/Utils'
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
            expect(data).toBeFalsy()
        })
})
