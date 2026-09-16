import fs = require('fs-extra')
import path = require('path')
import type DockerApi from '../src/docker/DockerApi'
import CertbotManager from '../src/user/system/CertbotManager'
import CaptainConstants from '../src/utils/CaptainConstants'

describe('orphaned certificate cleanup', () => {
    const certificatePem = fs.readFileSync(
        path.join(__dirname, '../template/fake-certs-src/nginx.crt')
    )

    beforeEach(() => {
        jest.useFakeTimers()
        jest.setSystemTime(new Date('2029-08-03T15:02:01Z'))
    })

    afterEach(() => {
        jest.restoreAllMocks()
        jest.useRealTimers()
    })

    test('deletes an eligible orphan through Certbot', async () => {
        jest.spyOn(fs, 'readdir').mockResolvedValue([
            'orphan.example.com.conf',
        ] as never)
        jest.spyOn(fs, 'readFile').mockResolvedValue(certificatePem as never)
        const executeCommand = jest
            .fn()
            .mockResolvedValue('Certificate deleted')
        const manager = new CertbotManager({
            executeCommand,
        } as unknown as DockerApi)

        await manager.deleteExpiringOrphanedCertificates([])

        expect(executeCommand).toHaveBeenCalledWith(
            CaptainConstants.certbotServiceName,
            [
                'certbot',
                'delete',
                '--cert-name',
                'orphan.example.com',
                '--non-interactive',
            ]
        )
    })

    test('continues cleanup when deleting one orphan fails', async () => {
        jest.spyOn(fs, 'readdir').mockResolvedValue([
            'first.example.com.conf',
            'second.example.com.conf',
        ] as never)
        jest.spyOn(fs, 'readFile').mockResolvedValue(certificatePem as never)
        const executeCommand = jest
            .fn()
            .mockRejectedValueOnce(new Error('delete failed'))
            .mockResolvedValueOnce('Certificate deleted')
        const manager = new CertbotManager({
            executeCommand,
        } as unknown as DockerApi)

        await manager.deleteExpiringOrphanedCertificates([])

        expect(executeCommand).toHaveBeenCalledTimes(2)
        expect(executeCommand.mock.calls[1][1]).toEqual([
            'certbot',
            'delete',
            '--cert-name',
            'second.example.com',
            '--non-interactive',
        ])
    })
})
