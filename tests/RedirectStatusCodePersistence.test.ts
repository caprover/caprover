import AppsDataStore from '../src/datastore/AppsDataStore'

async function saveWithStatusCode(
    storedCode: number | undefined,
    sentCode: number | undefined
) {
    const appsDataStore = new AppsDataStore({} as any, 'captain')
    jest.spyOn(appsDataStore, 'getAppDefinition').mockResolvedValue({
        redirectDomainStatusCode: storedCode,
        ports: [],
    } as any)
    const saveApp = jest.fn().mockResolvedValue(undefined)
    ;(appsDataStore as any).saveApp = saveApp

    await appsDataStore.updateAppDefinitionInDb(
        'test-app',
        undefined,
        '',
        1,
        './captain-definition',
        [],
        [],
        [],
        '',
        false,
        80,
        undefined,
        false,
        [],
        undefined as any,
        {} as any,
        '',
        'www.example.com',
        '',
        '',
        false,
        { enabled: false },
        sentCode
    )

    return saveApp.mock.calls[0][1].redirectDomainStatusCode
}

describe('redirect status code persistence', () => {
    test('stores the status code that is sent', async () => {
        expect(await saveWithStatusCode(undefined, 301)).toBe(301)
        expect(await saveWithStatusCode(301, 302)).toBe(302)
    })

    test('keeps the stored status code when an older client omits it', async () => {
        expect(await saveWithStatusCode(301, undefined)).toBe(301)
    })
})
