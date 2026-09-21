import AppsDataStore from '../src/datastore/AppsDataStore'

describe('custom domain ownership', () => {
    test('rejects a domain already attached to another app', async () => {
        const appsDataStore = new AppsDataStore({} as any, 'captain')
        jest.spyOn(appsDataStore, 'getAppDefinitions').mockResolvedValue({
            'first-app': {
                customDomain: [
                    {
                        publicDomain: 'Shared.Example.Test',
                        hasSsl: false,
                    },
                ],
            } as any,
            'second-app': { customDomain: [] } as any,
        })

        await expect(
            appsDataStore.ensureCustomDomainIsAvailable(
                'second-app',
                'shared.example.test'
            )
        ).rejects.toMatchObject({
            captainErrorType: 1110,
            apiMessage:
                'Custom domain shared.example.test is already attached to app first-app',
        })
    })

    test('allows the app that already owns the domain', async () => {
        const appsDataStore = new AppsDataStore({} as any, 'captain')
        jest.spyOn(appsDataStore, 'getAppDefinitions').mockResolvedValue({
            'first-app': {
                customDomain: [
                    { publicDomain: 'shared.example.test', hasSsl: false },
                ],
            } as any,
        })

        await expect(
            appsDataStore.ensureCustomDomainIsAvailable(
                'first-app',
                'shared.example.test'
            )
        ).resolves.toBeUndefined()
    })
})
