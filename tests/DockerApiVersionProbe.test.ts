import DockerApi from '../src/docker/DockerApi'

describe('DockerApi.buildVersionProbeOptions', () => {
    test('removes the version key so dockerode hits the unversioned /version endpoint', () => {
        // The Docker daemon will reject any client API version below its
        // minimum supported one (e.g., "client version 1.38 is too old"). The
        // probe must not pin a version - the /version endpoint itself is
        // unversioned and supported on every daemon. See issue #2401.
        const probeOptions = DockerApi.buildVersionProbeOptions({
            socketPath: '/var/run/docker.sock',
            version: 'v1.38',
        }) as { socketPath?: string; version?: string }

        expect(probeOptions.version).toBeUndefined()
        expect(probeOptions.socketPath).toBe('/var/run/docker.sock')
    })

    test('preserves host/port and other connection params while dropping version', () => {
        const probeOptions = DockerApi.buildVersionProbeOptions({
            host: 'docker.example.com',
            port: 2375,
            version: 'v1.44',
        }) as { host?: string; port?: number; version?: string }

        expect(probeOptions.host).toBe('docker.example.com')
        expect(probeOptions.port).toBe(2375)
        expect(probeOptions.version).toBeUndefined()
    })

    test('does not mutate the caller-provided connection params', () => {
        const connectionParams = {
            socketPath: '/var/run/docker.sock',
            version: 'v1.44',
        }
        DockerApi.buildVersionProbeOptions(connectionParams)
        expect(connectionParams.version).toBe('v1.44')
    })
})
