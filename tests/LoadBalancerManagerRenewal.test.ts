import type DataStore from '../src/datastore/DataStore'
import type DockerApi from '../src/docker/DockerApi'
import type CertbotManager from '../src/user/system/CertbotManager'
import LoadBalancerManager from '../src/user/system/LoadBalancerManager'
import Logger from '../src/utils/Logger'

describe('certificate renewal flow', () => {
    beforeEach(() => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.restoreAllMocks()
        jest.useRealTimers()
    })

    test('passes active domains to cleanup before renewal and reload', async () => {
        const calls: string[] = []
        const deleteExpiredOrphanedCertificates = jest
            .fn()
            .mockImplementation(async () => {
                calls.push('cleanup')
            })
        const renewAllCerts = jest.fn().mockImplementation(async () => {
            calls.push('renew')
        })
        const manager = new LoadBalancerManager(
            {} as DockerApi,
            {
                deleteExpiredOrphanedCertificates,
                renewAllCerts,
            } as unknown as CertbotManager,
            {} as DataStore
        )
        jest.spyOn(manager, 'getActiveSslDomains').mockImplementation(
            async () => {
                calls.push('get-active-domains')
                return ['active.example.com']
            }
        )
        jest.spyOn(manager, 'rePopulateNginxConfigFile').mockImplementation(
            async () => {
                calls.push('reload')
            }
        )

        await manager.renewAllCertsAndReload()

        expect(deleteExpiredOrphanedCertificates).toHaveBeenCalledWith([
            'active.example.com',
        ])
        expect(calls).toEqual([
            'get-active-domains',
            'cleanup',
            'renew',
            'reload',
        ])
    })

    test('continues renewal and reload when cleanup fails', async () => {
        const cleanupError = new Error('cleanup failed')
        const deleteExpiredOrphanedCertificates = jest
            .fn()
            .mockRejectedValue(cleanupError)
        const renewAllCerts = jest.fn().mockResolvedValue(undefined)
        const manager = new LoadBalancerManager(
            {} as DockerApi,
            {
                deleteExpiredOrphanedCertificates,
                renewAllCerts,
            } as unknown as CertbotManager,
            {} as DataStore
        )
        jest.spyOn(manager, 'getActiveSslDomains').mockResolvedValue([
            'active.example.com',
        ])
        const reload = jest
            .spyOn(manager, 'rePopulateNginxConfigFile')
            .mockResolvedValue()
        const errorLog = jest.spyOn(Logger, 'e').mockImplementation()

        await manager.renewAllCertsAndReload()

        expect(errorLog).toHaveBeenCalledWith(
            `Orphaned certificate cleanup failed: ${cleanupError}`
        )
        expect(renewAllCerts).toHaveBeenCalledTimes(1)
        expect(reload).toHaveBeenCalledTimes(1)
    })
})
