import * as yaml from 'yaml'
import { IDockerComposeService } from '../src/models/IOneClickAppModels'
import DockerComposeToServiceOverride, {
    ComposeExecutionSemantics,
    DOCKER_COMPOSE_TEMPLATE_NAME,
    resolveComposeExecutionSemantics,
} from '../src/utils/DockerComposeToServiceOverride'

function parseContainerSpec(
    service: IDockerComposeService,
    semantics: ComposeExecutionSemantics,
    path = 'services.app'
) {
    const raw =
        DockerComposeToServiceOverride.convertUnconsumedComposeParametersToServiceOverride(
            service,
            semantics,
            path
        )
    return raw ? yaml.parse(raw).TaskTemplate.ContainerSpec : undefined
}

describe('resolveComposeExecutionSemantics', () => {
    test.each([
        [4, 'OFFICIAL_REDIS', 'legacy'],
        [4, 'TEMPLATE_ONE_CLICK', 'legacy'],
        [4, undefined, 'legacy'],
        ['4', 'TEMPLATE_ONE_CLICK', 'legacy'],
        [3, 'TEMPLATE_ONE_CLICK', 'legacy'],
        [1, undefined, 'legacy'],
        [undefined, 'TEMPLATE_ONE_CLICK', 'legacy'],
        [null, undefined, 'legacy'],
        ['', undefined, 'legacy'],
        [5, 'OFFICIAL_REDIS', 'standard'],
        [5, 'TEMPLATE_ONE_CLICK', 'standard'],
        [5, undefined, 'standard'],
        ['5', 'TEMPLATE_ONE_CLICK', 'standard'],
        [4, DOCKER_COMPOSE_TEMPLATE_NAME, 'standard'],
        [5, DOCKER_COMPOSE_TEMPLATE_NAME, 'standard'],
        [undefined, DOCKER_COMPOSE_TEMPLATE_NAME, 'standard'],
    ] as const)(
        'resolves captainVersion=%j templateName=%j to %s',
        (captainVersion, templateName, expected) => {
            expect(
                resolveComposeExecutionSemantics(captainVersion, templateName)
            ).toBe(expected)
        }
    )

    test.each([6, 99, '6', 0, -1, 4.5, 'v5', 'invalid', true, {}])(
        'rejects unsupported captainVersion: %j',
        (captainVersion) => {
            expect(() =>
                resolveComposeExecutionSemantics(captainVersion)
            ).toThrow(/Unsupported captainVersion/)
            expect(() =>
                resolveComposeExecutionSemantics(
                    captainVersion,
                    DOCKER_COMPOSE_TEMPLATE_NAME
                )
            ).toThrow(/Unsupported captainVersion/)
        }
    )
})

describe('DockerComposeToServiceOverride', () => {
    describe('legacy semantics', () => {
        test.each([
            [
                'string command (legacy regex parser)',
                {
                    command:
                        'sh -c "redis-server --maxmemory-policy allkeys-lru --maxmemory 200mb"',
                },
                {
                    Command: [
                        'sh',
                        '-c',
                        'redis-server --maxmemory-policy allkeys-lru --maxmemory 200mb',
                    ],
                },
            ],
            [
                'array command',
                {
                    command: [
                        'sh',
                        '-c',
                        'redis-server --requirepass $REDIS_PASSWORD',
                    ],
                },
                {
                    Command: [
                        'sh',
                        '-c',
                        'redis-server --requirepass $REDIS_PASSWORD',
                    ],
                },
            ],
            [
                'entrypoint ignored alongside command',
                { entrypoint: ['/bin/sh', '-c'], command: ['echo', 'legacy'] },
                { Command: ['echo', 'legacy'] },
            ],
            ['entrypoint only ignored', { entrypoint: ['/bin/sh'] }, undefined],
            ['omitted fields', {}, undefined],
            ['empty string command', { command: '' }, undefined],
            ['null command', { command: null }, undefined],
            ['empty array command', { command: [] }, { Command: [] }],
        ] as [string, IDockerComposeService, unknown][])(
            '%s',
            (_label, service, expected) => {
                expect(parseContainerSpec(service, 'legacy')).toEqual(expected)
            }
        )
    })

    describe('standard semantics', () => {
        test('serializes full Swarm TaskTemplate.ContainerSpec alongside hostname and cap_add', () => {
            const raw =
                DockerComposeToServiceOverride.convertUnconsumedComposeParametersToServiceOverride(
                    {
                        hostname: ' worker-1 ',
                        cap_add: ['net_admin', 'CAP_SYS_TIME'],
                        entrypoint: ['/bin/sh', '-ec'],
                        command: ['echo hello && exec node app.js'],
                    },
                    'standard'
                )
            expect(yaml.parse(raw!)).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Hostname: 'worker-1',
                        CapabilityAdd: ['CAP_NET_ADMIN', 'CAP_SYS_TIME'],
                        Command: ['/bin/sh', '-ec'],
                        Args: ['echo hello && exec node app.js'],
                    },
                },
            })
        })

        test.each([
            ['omitted fields', {}, undefined],
            ['null fields', { entrypoint: null, command: null }, undefined],
            [
                'command array only',
                { command: ['redis-server', '--appendonly', 'yes'] },
                { Args: ['redis-server', '--appendonly', 'yes'] },
            ],
            [
                'command string only',
                { command: 'redis-server --appendonly yes' },
                { Args: ['redis-server', '--appendonly', 'yes'] },
            ],
            [
                'null entrypoint + command',
                { entrypoint: null, command: ['--port', '8080'] },
                { Args: ['--port', '8080'] },
            ],
            [
                'entrypoint array only',
                { entrypoint: ['/bin/sh', '-ec'] },
                { Command: ['/bin/sh', '-ec'] },
            ],
            [
                'entrypoint string only',
                { entrypoint: '/bin/sh -ec' },
                { Command: ['/bin/sh', '-ec'] },
            ],
            [
                'entrypoint + null command',
                { entrypoint: ['/usr/bin/app'], command: null },
                { Command: ['/usr/bin/app'] },
            ],
            [
                'entrypoint + empty array command suppresses image CMD',
                { entrypoint: ['/usr/bin/app'], command: [] },
                { Command: ['/usr/bin/app'] },
            ],
            [
                'entrypoint + empty string command suppresses image CMD',
                { entrypoint: ['/usr/bin/app'], command: '' },
                { Command: ['/usr/bin/app'] },
            ],
            [
                'entrypoint + whitespace command suppresses image CMD',
                { entrypoint: ['/usr/bin/app'], command: '   ' },
                { Command: ['/usr/bin/app'] },
            ],
            [
                'clear entrypoint ([]) + command uses Command: [""]',
                { entrypoint: [], command: ['/bin/app', '--serve'] },
                { Command: [''], Args: ['/bin/app', '--serve'] },
            ],
            [
                'clear entrypoint ("") + command uses Command: [""]',
                { entrypoint: '', command: '/bin/app --serve' },
                { Command: [''], Args: ['/bin/app', '--serve'] },
            ],
            [
                'clear entrypoint ([""]) + command uses Command: [""]',
                { entrypoint: [''], command: ['/bin/app'] },
                { Command: [''], Args: ['/bin/app'] },
            ],
            [
                'preserves single empty string arg in command array and quoted string',
                { entrypoint: ['/usr/bin/probe'], command: [''] },
                { Command: ['/usr/bin/probe'], Args: [''] },
            ],
            [
                'preserves empty quoted string command',
                { entrypoint: ['/usr/bin/probe'], command: '""' },
                { Command: ['/usr/bin/probe'], Args: [''] },
            ],
            [
                'preserves exact boundaries in array inputs',
                {
                    entrypoint: ['/bin/sh', '-c'],
                    command: ['  spaced  arg  ', '', '$HOME', 'a && b'],
                },
                {
                    Command: ['/bin/sh', '-c'],
                    Args: ['  spaced  arg  ', '', '$HOME', 'a && b'],
                },
            ],
            [
                'handles quotes, escapes, empty args, adjacent segments',
                {
                    command:
                        'cmd "hello world" \'single\' foo\\ bar baz\\"qux \\\'q\\\' "" \'\' --flag="a b" pre"mid"\'end\'',
                },
                {
                    Args: [
                        'cmd',
                        'hello world',
                        'single',
                        'foo bar',
                        'baz"qux',
                        "'q'",
                        '',
                        '',
                        '--flag=a b',
                        'premidend',
                    ],
                },
            ],
            [
                'handles multiline scripts and POSIX double-quote escapes',
                {
                    command:
                        'sh -ec "set -e\necho \\"line 1\\"\nprintf \'a\\nb\'\nexec node app.js"',
                },
                {
                    Args: [
                        'sh',
                        '-ec',
                        'set -e\necho "line 1"\nprintf \'a\\nb\'\nexec node app.js',
                    ],
                },
            ],
            [
                'handles backslash line continuations',
                { command: 'cmd foo\\\nbar "baz\\\r\nqux"' },
                { Args: ['cmd', 'foobar', 'bazqux'] },
            ],
        ] as [string, IDockerComposeService, unknown][])(
            '%s',
            (_label, service, expected) => {
                expect(parseContainerSpec(service, 'standard')).toEqual(
                    expected
                )
            }
        )

        test('preserves shell operators and variable references without host expansion', () => {
            process.env.CAPROVER_COMMAND_TEST_SECRET = 'host-secret'
            try {
                expect(
                    parseContainerSpec(
                        {
                            command:
                                'sh -c "echo $CAPROVER_COMMAND_TEST_SECRET && echo ${OTHER} | cat > /tmp/out; true"',
                        },
                        'standard'
                    )
                ).toEqual({
                    Args: [
                        'sh',
                        '-c',
                        'echo $CAPROVER_COMMAND_TEST_SECRET && echo ${OTHER} | cat > /tmp/out; true',
                    ],
                })
                expect(
                    parseContainerSpec(
                        {
                            command:
                                'echo a && echo b | cat > /tmp/x ; echo $CAPROVER_COMMAND_TEST_SECRET',
                        },
                        'standard'
                    )
                ).toEqual({
                    Args: [
                        'echo',
                        'a',
                        '&&',
                        'echo',
                        'b',
                        '|',
                        'cat',
                        '>',
                        '/tmp/x',
                        ';',
                        'echo',
                        '$CAPROVER_COMMAND_TEST_SECRET',
                    ],
                })
            } finally {
                delete process.env.CAPROVER_COMMAND_TEST_SECRET
            }
        })

        test.each([
            [
                { command: [] },
                'services.my-app.command: clearing the image default command without setting entrypoint is not supported by Docker Swarm',
            ],
            [
                { command: '' },
                'services.my-app.command: clearing the image default command without setting entrypoint is not supported by Docker Swarm',
            ],
            [
                { entrypoint: null, command: '   ' },
                'services.my-app.command: clearing the image default command without setting entrypoint is not supported by Docker Swarm',
            ],
            [
                { entrypoint: [] },
                'services.my-app.entrypoint: clearing the image default entrypoint requires an explicit non-empty command in Docker Swarm',
            ],
            [
                { entrypoint: '' },
                'services.my-app.entrypoint: clearing the image default entrypoint requires an explicit non-empty command in Docker Swarm',
            ],
            [
                { entrypoint: [''], command: null },
                'services.my-app.entrypoint: clearing the image default entrypoint requires an explicit non-empty command in Docker Swarm',
            ],
            [
                { entrypoint: [], command: [] },
                'services.my-app.entrypoint: clearing both entrypoint and command leaves no command to execute',
            ],
            [
                { entrypoint: '', command: '' },
                'services.my-app.entrypoint: clearing both entrypoint and command leaves no command to execute',
            ],
            [
                { entrypoint: 123 },
                'services.my-app.entrypoint: expected a string or an array of strings',
            ],
            [
                { command: { run: 'now' } },
                'services.my-app.command: expected a string or an array of strings',
            ],
            [
                { entrypoint: true },
                'services.my-app.entrypoint: expected a string or an array of strings',
            ],
            [
                { entrypoint: ['/bin/sh', 42] },
                'services.my-app.entrypoint[1]: expected a string',
            ],
            [
                { command: ['echo', null] },
                'services.my-app.command[1]: expected a string',
            ],
            [
                { command: 'sh -c "unterminated' },
                'services.my-app.command: unterminated double quote',
            ],
            [
                { entrypoint: "sh -c 'unterminated" },
                'services.my-app.entrypoint: unterminated single quote',
            ],
            [
                { command: 'echo trailing\\' },
                'services.my-app.command: trailing escape character',
            ],
            [
                { command: 'echo "trailing\\' },
                'services.my-app.command: unterminated double quote',
            ],
            [
                { command: 'echo bad\0arg' },
                'services.my-app.command: argument cannot contain NUL characters',
            ],
            [
                { entrypoint: ['/bin/sh', '-c\0'] },
                'services.my-app.entrypoint[1]: argument cannot contain NUL characters',
            ],
        ])('rejects invalid input %j', (service, expectedError) => {
            expect(() =>
                parseContainerSpec(
                    service as unknown as IDockerComposeService,
                    'standard',
                    'services.my-app'
                )
            ).toThrow(expectedError)
        })
    })
})
