import configstore = require('configstore')
import AppsDataStore from '../src/datastore/AppsDataStore'
import Utils from '../src/utils/Utils'

describe('AppsDataStore deletion', () => {
    test('allows deleting an existing app with a name that is no longer valid', async () => {
        const data = {
            get: jest.fn(() => ({})),
            delete: jest.fn(),
        } as unknown as configstore
        jest.spyOn(Utils, 'getDelayedPromise').mockResolvedValue(undefined)

        const appsDataStore = new AppsDataStore(data, 'captain')

        await expect(
            appsDataStore.deleteAppDefinition('legacy invalid app')
        ).resolves.toBeUndefined()
        expect(data.delete).toHaveBeenCalledWith(
            'appDefinitions.legacy invalid app'
        )
    })
})
