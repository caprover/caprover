import AppBackupDataStore from '../src/datastore/AppBackupDataStore'
import { IRcloneRemote } from '../src/models/AppBackup'
import AppBackupManager from '../src/user/system/AppBackupManager'
import CaptainEncryptor from '../src/utils/Encryptor'

// Minimal in-memory stand-in for `configstore` (get/set on a backing map).
function fakeConfigstore() {
    const map: { [k: string]: any } = {}
    return {
        get: (key: string) => map[key],
        set: (key: string, value: any) => {
            map[key] = JSON.parse(JSON.stringify(value))
        },
    } as any
}

function makeStore() {
    const store = new AppBackupDataStore(fakeConfigstore(), 'captain')
    store.setEncryptor(new CaptainEncryptor('x'.repeat(40)))
    return store
}

describe('AppBackupManager.buildRcloneConf', () => {
    it('builds an S3 section without auxiliary files', () => {
        const remote: IRcloneRemote = {
            id: '1',
            name: 'my-s3',
            type: 's3',
            params: {
                access_key_id: 'AKIA',
                secret_access_key: 'SECRET',
                endpoint: 'https://s3.example.com',
                region: 'eu-west-1',
            },
        }
        const { body, files } = AppBackupManager.buildRcloneConf(remote)
        expect(body).toContain('[remote]')
        expect(body).toContain('type = s3')
        expect(body).toContain('access_key_id = AKIA')
        expect(body).toContain('secret_access_key = SECRET')
        expect(body).toContain('endpoint = https://s3.example.com')
        expect(body).toContain('region = eu-west-1')
        expect(files).toHaveLength(0)
    })

    it('builds a B2 section', () => {
        const { body, files } = AppBackupManager.buildRcloneConf({
            id: '1',
            name: 'b2',
            type: 'b2',
            params: { account: 'acc', key: 'appkey' },
        })
        expect(body).toContain('type = b2')
        expect(body).toContain('account = acc')
        expect(body).toContain('key = appkey')
        expect(files).toHaveLength(0)
    })

    it('emits a service-account file for Google Drive', () => {
        const { body, files } = AppBackupManager.buildRcloneConf({
            id: '1',
            name: 'gd',
            type: 'gdrive',
            params: {
                service_account_json: '{"type":"service_account"}',
                root_folder_id: 'abc',
            },
        })
        expect(body).toContain('type = drive')
        expect(body).toContain(
            'service_account_file = /config/rclone/gdrive-sa.json'
        )
        expect(body).toContain('root_folder_id = abc')
        expect(files).toEqual([
            { name: 'gdrive-sa.json', content: '{"type":"service_account"}' },
        ])
    })

    it('emits a key file for SFTP', () => {
        const { body, files } = AppBackupManager.buildRcloneConf({
            id: '1',
            name: 'sftp',
            type: 'sftp',
            params: {
                host: 'h',
                user: 'u',
                port: '2222',
                private_key: 'PEMDATA',
            },
        })
        expect(body).toContain('type = sftp')
        expect(body).toContain('host = h')
        expect(body).toContain('port = 2222')
        expect(body).toContain('key_file = /config/rclone/id_key')
        expect(files).toEqual([{ name: 'id_key', content: 'PEMDATA' }])
    })

    it('passes through a raw config body verbatim', () => {
        const { body } = AppBackupManager.buildRcloneConf({
            id: '1',
            name: 'raw',
            type: 'raw',
            params: { conf: 'type = webdav\nurl = https://dav.example.com' },
        })
        expect(body).toContain('[remote]')
        expect(body).toContain('type = webdav')
        expect(body).toContain('url = https://dav.example.com')
    })
})

describe('AppBackupDataStore remotes', () => {
    it('encrypts params at rest and round-trips them', async () => {
        const store = makeStore()
        const id = await store.addRemote('r1', 's3', {
            access_key_id: 'AKIA',
            secret_access_key: 'topsecret',
        })

        const all = await store.getAllRemotes()
        expect(all).toHaveLength(1)
        expect(all[0].params.secret_access_key).toBe('topsecret')

        // Masked view must never carry secrets.
        const masked = await store.getAllRemotesMasked()
        expect(masked[0]).toEqual({ id, name: 'r1', type: 's3' })
        expect(JSON.stringify(masked)).not.toContain('topsecret')
    })

    it('rejects duplicate remote names', async () => {
        const store = makeStore()
        await store.addRemote('dup', 'b2', { account: 'a', key: 'k' })
        await expect(
            store.addRemote('dup', 'b2', { account: 'a', key: 'k' })
        ).rejects.toBeDefined()
    })

    it('prevents deleting a remote still used by an app config', async () => {
        const store = makeStore()
        const id = await store.addRemote('used', 's3', {
            access_key_id: 'a',
            secret_access_key: 's',
        })
        await store.setAppConfig('my-app', {
            enabled: true,
            remoteId: id,
            remotePath: 'bucket',
            volumeNames: ['data'],
        })
        await expect(store.deleteRemote(id)).rejects.toBeDefined()

        // Once the config is gone, deletion succeeds.
        await store.deleteAppConfig('my-app')
        await store.deleteRemote(id)
        expect(await store.getAllRemotes()).toHaveLength(0)
    })
})

describe('AppBackupDataStore jobs', () => {
    it('stores newest-first and updates by id', async () => {
        const store = makeStore()
        await store.addJob({
            id: 'j1',
            appName: 'app',
            type: 'backup',
            remoteId: 'r',
            volumeNames: ['v'],
            status: 'running',
            startedAt: 1,
            logFile: 'j1.log',
        })
        await store.updateJob('j1', { status: 'success', exitCode: 0 })
        const jobs = await store.getJobs('app')
        expect(jobs[0].status).toBe('success')
        expect(jobs[0].exitCode).toBe(0)
    })
})
