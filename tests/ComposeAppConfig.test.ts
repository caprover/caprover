import * as yaml from 'yaml'
import composeAppConfig from '../src/utils/ComposeAppConfig'
import { IDockerComposeService } from '../src/models/IOneClickAppModels'

describe('Compose app configuration', () => {
    test('map/list environments and short/long mounts and ports produce the same app config', () => {
        const short = yaml.parse(`
environment:
  TOKEN: a=b=c
  EMPTY: ""
  COUNT: 0
  ENABLED: "false"
volumes:
  - data:/data
  - /srv/files:/files
ports:
  - "8080:80"
  - "5353:53/udp"
`)
        const long = yaml.parse(`
environment:
  - TOKEN=a=b=c
  - EMPTY=
  - COUNT=0
  - ENABLED=false
volumes:
  - type: volume
    source: data
    target: /data
  - type: bind
    source: /srv/files
    target: /files
    read_only: false
ports:
  - target: 80
    published: "8080"
  - target: 53
    published: 5353
    protocol: udp
`)
        expect(composeAppConfig(short)).toEqual({
            envVars: [
                { key: 'TOKEN', value: 'a=b=c' },
                { key: 'EMPTY', value: '' },
                { key: 'COUNT', value: '0' },
                { key: 'ENABLED', value: 'false' },
            ],
            volumes: [
                { volumeName: 'data', containerPath: '/data' },
                { hostPath: '/srv/files', containerPath: '/files' },
            ],
            ports: [
                { hostPort: 8080, containerPort: 80 },
                { hostPort: 5353, containerPort: 53, protocol: 'udp' },
            ],
        })
        expect(composeAppConfig(long)).toEqual(composeAppConfig(short))
    })

    test('handles mixed entries and explicit port protocol and publishing mode', () => {
        expect(
            composeAppConfig({
                volumes: [
                    'data:/data:rw',
                    { type: 'bind', source: '/srv', target: '/srv' },
                ],
                ports: [
                    '8080:80/tcp',
                    {
                        published: 9000,
                        target: 90,
                        protocol: 'udp',
                        mode: 'host',
                    },
                ],
            })
        ).toMatchObject({
            volumes: [
                { volumeName: 'data', containerPath: '/data' },
                { hostPath: '/srv', containerPath: '/srv' },
            ],
            ports: [
                { hostPort: 8080, containerPort: 80, protocol: 'tcp' },
                {
                    hostPort: 9000,
                    containerPort: 90,
                    protocol: 'udp',
                    publishMode: 'host',
                },
            ],
        })
    })

    test('omits unresolved variables without reading the server environment', () => {
        process.env.CAPROVER_COMPOSE_TEST_SECRET = 'server-secret'
        try {
            expect(
                composeAppConfig({
                    environment: [
                        'CAPROVER_COMPOSE_TEST_SECRET',
                        'KEEP=',
                        'DUP=first',
                        'DUP=last',
                        'REMOVE=value',
                        'REMOVE',
                    ],
                }).envVars
            ).toEqual([
                { key: 'KEEP', value: '' },
                { key: 'DUP', value: 'last' },
            ])
            expect(
                composeAppConfig({
                    environment: {
                        CAPROVER_COMPOSE_TEST_SECRET: null,
                        ZERO: 0,
                        FALSE: false,
                    },
                }).envVars
            ).toEqual([
                { key: 'ZERO', value: '0' },
                { key: 'FALSE', value: 'false' },
            ])
        } finally {
            delete process.env.CAPROVER_COMPOSE_TEST_SECRET
        }
    })

    test.each([
        [{ environment: ['=secret'] }, 'environment'],
        [{ environment: [{ KEY: 'secret' }] }, 'environment'],
        [{ environment: { KEY: { nested: 'secret' } } }, 'environment'],
        [{ environment: 'KEY=secret' }, 'environment'],
        [{ volumes: { data: '/data' } }, 'volumes'],
        [{ volumes: ['/data'] }, 'volumes'],
        [{ volumes: ['./data:/data'] }, 'volumes'],
        [{ volumes: ['data:/data:ro'] }, 'mount options'],
        [
            {
                volumes: [
                    {
                        type: 'volume',
                        source: 'data',
                        target: '/data',
                        read_only: true,
                    },
                ],
            },
            'read_only',
        ],
        [
            { volumes: [{ type: 'bind', source: './data', target: '/data' }] },
            'absolute bind',
        ],
        [{ volumes: [{ type: 'tmpfs', target: '/data' }] }, 'type'],
        [
            {
                volumes: [
                    {
                        type: 'volume',
                        source: 'data',
                        target: '/data',
                        volume: { nocopy: true },
                    },
                ],
            },
            'option volume',
        ],
        [{ ports: { 8080: 80 } }, 'ports'],
        [{ ports: ['127.0.0.1:8080:80'] }, 'host IPs'],
        [
            { ports: [{ published: 8080, target: 80, host_ip: '127.0.0.1' }] },
            'host_ip',
        ],
        [{ ports: ['8080-8082:80-82'] }, 'ranges'],
        [{ ports: [80] }, 'ports'],
        [{ ports: [{ target: 80 }] }, 'port numbers'],
        [{ ports: [{ published: '8080-8090', target: 80 }] }, 'port numbers'],
        [{ ports: [{ published: 8080, target: true }] }, 'port numbers'],
        [
            { ports: [{ published: 8080, target: 80, protocol: 'sctp' }] },
            'protocol',
        ],
        [{ ports: [{ published: 8080, target: 80, mode: 'invalid' }] }, 'mode'],
        [{ ports: ['0:80'] }, 'port numbers'],
        [{ ports: ['65535:80'] }, 'port numbers'],
    ])('rejects unsupported or malformed config %j', (service, message) => {
        expect(() =>
            composeAppConfig(service as IDockerComposeService)
        ).toThrow(message)
    })

    test.each([
        ['__proto__=value', 'constructor=other'],
        JSON.parse('{"__proto__":"value","constructor":"other"}'),
    ])('preserves special environment names as data: %j', (environment) => {
        expect(composeAppConfig({ environment }).envVars).toEqual([
            { key: '__proto__', value: 'value' },
            { key: 'constructor', value: 'other' },
        ])
    })

    test('preserves the input service and unrelated fields', () => {
        const service: IDockerComposeService = {
            image: 'nginx',
            environment: ['TOKEN=a=b', 'EMPTY='],
            volumes: [
                'data:/data',
                { type: 'bind', source: '/srv', target: '/srv' },
            ],
            ports: [
                '8080:80',
                { published: 9000, target: 90, protocol: 'udp', mode: 'host' },
            ],
            command: ['run', '--verbose'],
            depends_on: ['db'],
            hostname: 'example',
        }
        const snapshot = JSON.stringify(service)
        const first = composeAppConfig(service)
        expect(JSON.stringify(service)).toBe(snapshot)
        expect(composeAppConfig(service)).toEqual(first)
    })

    test.each([
        [{ environment: ['OK=value', '=secret'] }, 'environment[1]'],
        [{ environment: { TOKEN: ['secret'] } }, 'environment.TOKEN'],
        [
            {
                volumes: [
                    'data:/data',
                    {
                        type: 'volume',
                        source: 'cache',
                        target: '/cache',
                        read_only: true,
                    },
                ],
            },
            'volumes[1].read_only',
        ],
        [{ volumes: [{ type: 'tmpfs', target: '/tmp' }] }, 'volumes[0].type'],
        [
            { volumes: [{ type: 'volume', target: '/data' }] },
            'volumes[0].source',
        ],
        [
            {
                volumes: [
                    { type: 'volume', source: 'data', target: 'relative' },
                ],
            },
            'volumes[0].target',
        ],
        [{ volumes: [[]] }, 'volumes[0]'],
        [
            {
                ports: [
                    '8080:80',
                    { target: 80, published: 9000, host_ip: '127.0.0.1' },
                ],
            },
            'ports[1].host_ip',
        ],
        [{ ports: [{ published: 8080, target: 0 }] }, 'ports[0].target'],
        [{ ports: [{ published: 'bad', target: 80 }] }, 'ports[0].published'],
        [
            { ports: [{ published: 8080, target: 80, protocol: 'bad' }] },
            'ports[0].protocol',
        ],
        [
            { ports: [{ published: 8080, target: 80, mode: 'bad' }] },
            'ports[0].mode',
        ],
        [{ ports: [[]] }, 'ports[0]'],
    ])('reports the exact invalid field: %j', (service, path) => {
        expect(() =>
            composeAppConfig(service as IDockerComposeService, 'services.app')
        ).toThrow(`services.app.${path}:`)
    })
})
