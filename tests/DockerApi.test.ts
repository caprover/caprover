import DockerApi from '../src/docker/DockerApi'

let mockHostApiVersion = '1.44'

jest.mock('dockerode', () => {
    return class MockDockerode {
        version() {
            if (mockHostApiVersion === 'unavailable') {
                return Promise.reject(
                    new Error('Cannot reach the Docker daemon')
                )
            }
            return Promise.resolve({ ApiVersion: mockHostApiVersion })
        }
    }
})

function loadDockerApiWithFreshProbe() {
    let instance: typeof DockerApi | undefined
    jest.isolateModules(() => {
        instance = require('../src/docker/DockerApi').default
    })
    return instance as typeof DockerApi
}

describe('DockerApi startup probe', () => {
    beforeEach(() => {
        mockHostApiVersion = '1.44'
    })

    test('stores the host API version and flags a host that is too old', async () => {
        mockHostApiVersion = '1.43'

        const api = loadDockerApiWithFreshProbe()
        await api.get().hostDockerApiVersionReady

        expect(api.get().hostDockerApiVersion).toBe('1.43')
        expect(api.get().dockerNeedsUpdate).toBe(true)
    })

    test('stores the host API version without flagging a compatible host', async () => {
        mockHostApiVersion = '1.44'

        const api = loadDockerApiWithFreshProbe()
        await api.get().hostDockerApiVersionReady

        expect(api.get().hostDockerApiVersion).toBe('1.44')
        expect(api.get().dockerNeedsUpdate).toBe(false)
    })

    test('leaves the host API version unknown when the probe fails', async () => {
        mockHostApiVersion = 'unavailable'

        const api = loadDockerApiWithFreshProbe()
        // Readiness resolves even though the probe rejected: a failed probe
        // logs and keeps the fail-open behavior.
        await api.get().hostDockerApiVersionReady

        expect(api.get().hostDockerApiVersion).toBeUndefined()
        expect(api.get().dockerNeedsUpdate).toBe(false)
    })
})
