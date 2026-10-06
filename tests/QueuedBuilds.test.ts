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

    test('a service update failure advances the build queue only once', async () => {
        const first = deferred<string>()
        const second = deferred<string>()
        const ensureImage = jest
            .fn()
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise)
            .mockResolvedValueOnce('img-captain-third:1')
        const manager = serviceManager(ensureImage)

        ;(manager.ensureServiceInitedAndUpdated as jest.Mock)
            .mockRejectedValueOnce(new Error('first service update failed'))
            .mockResolvedValue(undefined)

        const running = manager.scheduleDeployNewVersion('first', source)
        const queuedSecond = manager.scheduleDeployNewVersion('second', source)
        const queuedThird = manager.scheduleDeployNewVersion('third', source)

        first.resolve('img-captain-first:1')
        await expect(running).rejects.toThrow('first service update failed')

        // The second build should be running while the third remains queued.
        // Before the fix, the service-update failure advanced the queue again
        // and started both queued builds concurrently.
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(ensureImage).toHaveBeenCalledTimes(2)
        expect(ensureImage.mock.calls.map((call) => call[1])).toEqual([
            'first',
            'second',
        ])

        second.resolve('img-captain-second:1')
        await queuedSecond
        await queuedThird

        expect(ensureImage.mock.calls.map((call) => call[1])).toEqual([
            'first',
            'second',
            'third',
        ])
    })
})
