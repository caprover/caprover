jest.mock('../src/docker/DockerApi', () => ({
    __esModule: true,
    default: { get: jest.fn(() => ({})) },
}))

jest.mock('../src/datastore/DataStoreProvider', () => ({
    __esModule: true,
    default: { getDataStore: jest.fn() },
}))

import DataStoreProvider from '../src/datastore/DataStoreProvider'
import { injectUserForBuildTrigger } from '../src/injection/Injector'

describe('build trigger token injection', () => {
    it('returns not authorized for a mismatched app deploy token', async () => {
        const getAppDefinition = jest.fn().mockResolvedValue({
            appDeployTokenConfig: {
                enabled: true,
                appDeployToken: 'expected-token',
            },
        })
        ;(DataStoreProvider.getDataStore as jest.Mock).mockReturnValue({
            getAppsDataStore: () => ({ getAppDefinition }),
        })

        let resolveResponse: () => void = () => undefined
        const responseSent = new Promise<void>((resolve) => {
            resolveResponse = resolve
        })
        const response = {
            locals: { namespace: 'captain' },
            send: jest.fn(() => resolveResponse()),
        }
        const request = {
            header: jest.fn((name: string) =>
                name === 'x-captain-app-token' ? 'invalid-token' : undefined
            ),
            params: { appName: 'test-app' },
        }
        const next = jest.fn()

        injectUserForBuildTrigger()(request as any, response as any, next)
        await responseSent

        expect(response.send).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 1102,
                description: 'The request is not authorized.',
            })
        )
        expect(next).not.toHaveBeenCalled()
    })
})
