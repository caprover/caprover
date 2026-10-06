import ServiceManager from '../src/user/ServiceManager'

function deferred<T>() {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((res) => {
        resolve = res
    })
    return { promise, resolve }
}

// Lets the pending callbacks run, then reports whether the promise has settled.
async function stateOf(promise: Promise<unknown>) {
    const pending = Symbol('pending')
    const result = await Promise.race([
        promise.then(
            () => 'resolved',
            () => 'rejected'
        ),
        new Promise((resolve) => setTimeout(() => resolve(pending), 50)),
    ])
    return result === pending ? 'pending' : result
}

describe('ServiceManager queued builds', () => {
    const source = {
        captainDefinitionContentSource: {
            captainDefinitionContent: '{}',
            gitHash: '',
        },
    }

    function serviceManager(ensureImage: jest.Mock) {
        const appsDataStore = {
            createNewVersion: jest.fn().mockResolvedValue(1),
            getAppDefinition: jest.fn().mockResolvedValue({
                envVars: [],
                captainDefinitionRelativeFilePath: './captain-definition',
            }),
            setDeployedVersionAndImage: jest.fn().mockResolvedValue(undefined),
        }
        const manager = new ServiceManager(
            {
                getNameSpace: () => 'captain',
                getAppsDataStore: () => appsDataStore,
                getRegistriesDataStore: () => ({}),
            } as any,
            {} as any,
            {} as any,
            {} as any,
            { trackEvent: jest.fn() } as any,
            {} as any
        )
        ;(manager as any).imageMaker = { ensureImage }
        jest.spyOn(manager, 'ensureServiceInitedAndUpdated').mockResolvedValue(
            undefined as any
        )
        return manager
    }

    test('a build queued behind another resolves once it has run', async () => {
        // A one-click app registered while another app builds waits on this promise
        // (registerAppDefinition), so a promise that never settles stalls the install
        // at "Registering <app>" for good, although the build itself ran.
        const first = deferred<string>()
        const ensureImage = jest
            .fn()
            .mockReturnValueOnce(first.promise)
            .mockResolvedValueOnce('img-captain-second:1')
        const manager = serviceManager(ensureImage)

        const running = manager.scheduleDeployNewVersion('first', source)
        const queued = manager.scheduleDeployNewVersion('second', source)
        first.resolve('img-captain-first:1')
        await running

        expect(await stateOf(queued)).toBe('resolved')
        expect(ensureImage).toHaveBeenCalledTimes(2)
    })

    test('a build queued behind another rejects with its own error', async () => {
        const first = deferred<string>()
        const ensureImage = jest
            .fn()
            .mockReturnValueOnce(first.promise)
            .mockRejectedValueOnce(new Error('second build failed'))
        const manager = serviceManager(ensureImage)

        const running = manager.scheduleDeployNewVersion('first', source)
        const queued = manager.scheduleDeployNewVersion('second', source)
        first.resolve('img-captain-first:1')
        await running

        expect(await stateOf(queued)).toBe('rejected')
        await expect(queued).rejects.toThrow('second build failed')
    })
})
