import configstore = require('configstore')
import AppsDataStore from '../src/datastore/AppsDataStore'

describe('app definition defaults', () => {
    test('enables WebSocket support for new apps without changing existing apps', async () => {
        const existingApp = { websocketSupport: false }
        const data = {
            get: jest.fn((key: string) =>
                key === 'appDefinitions.existing-app'
                    ? existingApp
                    : undefined
            ),
            set: jest.fn(),
        } as unknown as configstore
        const appsDataStore = new AppsDataStore(data, 'captain')

        await appsDataStore.registerAppDefinition('new-app', undefined, false)

        expect(data.set).toHaveBeenCalledWith(
            'appDefinitions.new-app',
            expect.objectContaining({ websocketSupport: true })
        )
        expect(data.set).toHaveBeenCalledTimes(1)
        expect(existingApp.websocketSupport).toBe(false)
    })
})
