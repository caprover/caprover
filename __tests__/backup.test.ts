import BackupManager from '../src/user/system/BackupManager'

test('BackupManager', () => {
    const bk = new BackupManager()
    return bk.checkAndPrepareRestoration().then(function(data) {
        expect(data).toBeFalsy()
    })
})
