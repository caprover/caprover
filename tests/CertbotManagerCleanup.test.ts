import fs = require('fs-extra')
import path = require('path')
import type DockerApi from '../src/docker/DockerApi'
import CertbotManager from '../src/user/system/CertbotManager'
import CaptainConstants from '../src/utils/CaptainConstants'
import Logger from '../src/utils/Logger'

describe('orphaned certificate cleanup', () => {
    const certificatePem = fs.readFileSync(
        path.join(__dirname, '../template/fake-certs-src/nginx.crt')
    )

    beforeEach(() => {
        jest.useFakeTimers()
        jest.setSystemTime(new Date('2029-08-04T15:02:01Z'))
    })

    afterEach(() => {
        jest.restoreAllMocks()
        jest.useRealTimers()
    })

    test('deletes an eligible orphan through Certbot', async () => {
        jest.spyOn(fs, 'readdir').mockResolvedValue([
            'orphan.example.com.conf',
        ] as never)
        const readFile = jest
            .spyOn(fs, 'readFile')
            .mockResolvedValue(certificatePem as never)
        const executeCommand = jest
            .fn()
            .mockResolvedValue(
                'Deleted all files relating to certificate orphan.example.com.'
            )
        const manager = new CertbotManager({
            executeCommand,
        } as unknown as DockerApi)

        await manager.deleteExpiredOrphanedCertificates(() =>
            Promise.resolve([])
        )

        expect(readFile).toHaveBeenCalledTimes(1)
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
        const errorLog = jest.spyOn(Logger, 'e').mockImplementation()
        const executeCommand = jest
            .fn()
            .mockResolvedValueOnce('Certbot failed to delete the certificate')
            .mockResolvedValueOnce(
                'Deleted all files relating to certificate second.example.com.'
            )
        const manager = new CertbotManager({
            executeCommand,
        } as unknown as DockerApi)

        await manager.deleteExpiredOrphanedCertificates(() =>
            Promise.resolve([])
        )

        expect(executeCommand).toHaveBeenCalledTimes(2)
        expect(errorLog).toHaveBeenCalledWith(
            expect.stringContaining('Unexpected output from Certbot')
        )
        expect(executeCommand.mock.calls[1][1]).toEqual([
            'certbot',
            'delete',
            '--cert-name',
            'second.example.com',
            '--non-interactive',
        ])
    })

    test('rechecks active domains while holding the Certbot lock', async () => {
        jest.spyOn(fs, 'readdir').mockResolvedValue([
            'active.example.com.conf',
        ] as never)
        jest.spyOn(fs, 'readFile').mockResolvedValue(certificatePem as never)
        const executeCommand = jest.fn()
        const manager = new CertbotManager({
            executeCommand,
        } as unknown as DockerApi)
        const getActiveDomains = jest.fn().mockImplementation(() => {
            expect(() => manager.lock()).toThrow(
                'Another operation is in process for Certbot'
            )
            return Promise.resolve(['ACTIVE.EXAMPLE.COM'])
        })

        await manager.deleteExpiredOrphanedCertificates(getActiveDomains)

        expect(getActiveDomains).toHaveBeenCalledTimes(1)
        expect(executeCommand).not.toHaveBeenCalled()
    })
})
