import * as yaml from 'yaml'
import { IDockerComposeService } from '../src/models/IOneClickAppModels'
import DockerComposeToServiceOverride, {
    DOCKER_COMPOSE_TEMPLATE_NAME,
    resolveComposeExecutionSemantics,
} from '../src/utils/DockerComposeToServiceOverride'

function parseOverride(
    service: IDockerComposeService,
    semantics: 'legacy' | 'standard',
    path = 'services.app'
) {
    const raw =
        DockerComposeToServiceOverride.convertUnconsumedComposeParametersToServiceOverride(
            service,
            semantics,
            path
        )
    return raw ? yaml.parse(raw) : undefined
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
        test('maps string command to ContainerSpec.Command with legacy regex parser', () => {
            expect(
                parseOverride(
                    {
                        command:
                            'sh -c "redis-server --maxmemory-policy allkeys-lru --maxmemory 200mb"',
                    },
                    'legacy'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: [
                            'sh',
                            '-c',
                            'redis-server --maxmemory-policy allkeys-lru --maxmemory 200mb',
                        ],
                    },
                },
            })
        })

        test('maps array command to ContainerSpec.Command', () => {
            expect(
                parseOverride(
                    {
                        command: [
                            'sh',
                            '-c',
                            'redis-server --requirepass $REDIS_PASSWORD',
                        ],
                    },
                    'legacy'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: [
                            'sh',
                            '-c',
                            'redis-server --requirepass $REDIS_PASSWORD',
                        ],
                    },
                },
            })
        })

        test('ignores entrypoint under legacy semantics', () => {
            expect(
                parseOverride(
                    {
                        entrypoint: ['/bin/sh', '-c'],
                        command: ['echo', 'legacy'],
                    },
                    'legacy'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: ['echo', 'legacy'],
                    },
                },
            })

            expect(
                parseOverride({ entrypoint: ['/bin/sh', '-c'] }, 'legacy')
            ).toBeUndefined()
        })

        test('preserves legacy empty and omitted value handling', () => {
            expect(parseOverride({}, 'legacy')).toBeUndefined()
            expect(parseOverride({ command: '' }, 'legacy')).toBeUndefined()
            expect(parseOverride({ command: null }, 'legacy')).toBeUndefined()
            expect(parseOverride({ command: [] }, 'legacy')).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: [],
                    },
                },
            })
        })
    })

    describe('standard semantics', () => {
        test('maps command only to ContainerSpec.Args', () => {
            expect(
                parseOverride(
                    { command: ['redis-server', '--appendonly', 'yes'] },
                    'standard'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Args: ['redis-server', '--appendonly', 'yes'],
                    },
                },
            })

            expect(
                parseOverride(
                    { command: 'redis-server --appendonly yes' },
                    'standard'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Args: ['redis-server', '--appendonly', 'yes'],
                    },
                },
            })
        })

        test('maps entrypoint only to ContainerSpec.Command', () => {
            expect(
                parseOverride({ entrypoint: ['/bin/sh', '-ec'] }, 'standard')
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: ['/bin/sh', '-ec'],
                    },
                },
            })

            expect(
                parseOverride({ entrypoint: '/bin/sh -ec' }, 'standard')
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: ['/bin/sh', '-ec'],
                    },
                },
            })
        })

        test('maps both entrypoint and command to Command and Args', () => {
            expect(
                parseOverride(
                    {
                        entrypoint: ['/bin/sh', '-ec'],
                        command: ['echo hello && exec node app.js'],
                    },
                    'standard'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: ['/bin/sh', '-ec'],
                        Args: ['echo hello && exec node app.js'],
                    },
                },
            })
        })

        test('preserves image defaults when fields are omitted or null', () => {
            expect(parseOverride({}, 'standard')).toBeUndefined()
            expect(
                parseOverride({ entrypoint: null, command: null }, 'standard')
            ).toBeUndefined()
            expect(
                parseOverride(
                    { entrypoint: null, command: ['--port', '8080'] },
                    'standard'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Args: ['--port', '8080'],
                    },
                },
            })
            expect(
                parseOverride(
                    { entrypoint: ['/usr/bin/app'], command: null },
                    'standard'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: ['/usr/bin/app'],
                    },
                },
            })
        })

        test('clears image default CMD when entrypoint is set and command is empty', () => {
            for (const emptyCommand of [[], '', '   ']) {
                expect(
                    parseOverride(
                        {
                            entrypoint: ['/usr/bin/app'],
                            command: emptyCommand,
                        },
                        'standard'
                    )
                ).toEqual({
                    TaskTemplate: {
                        ContainerSpec: {
                            Command: ['/usr/bin/app'],
                        },
                    },
                })
            }
        })

        test('clears image default ENTRYPOINT via Command: [""] when non-empty command is provided', () => {
            for (const emptyEntrypoint of [[], '', '   ', ['']]) {
                expect(
                    parseOverride(
                        {
                            entrypoint: emptyEntrypoint,
                            command: ['/bin/app', '--serve'],
                        },
                        'standard'
                    )
                ).toEqual({
                    TaskTemplate: {
                        ContainerSpec: {
                            Command: [''],
                            Args: ['/bin/app', '--serve'],
                        },
                    },
                })
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
        ])(
            'rejects unsupported empty-value combination %j',
            (service, expectedError) => {
                expect(() =>
                    parseOverride(service, 'standard', 'services.my-app')
                ).toThrow(expectedError)
            }
        )

        test('handles quoted, escaped, empty, adjacent, and multiline string arguments', () => {
            expect(
                parseOverride(
                    {
                        command:
                            "cmd \"hello world\" 'single quoted' foo\\ bar baz\\\"qux \\'single\\'",
                    },
                    'standard'
                )?.TaskTemplate.ContainerSpec.Args
            ).toEqual([
                'cmd',
                'hello world',
                'single quoted',
                'foo bar',
                'baz"qux',
                "'single'",
            ])

            expect(
                parseOverride(
                    {
                        command: 'cmd "" \'\' --flag="a b" pre"mid"\'end\'',
                    },
                    'standard'
                )?.TaskTemplate.ContainerSpec.Args
            ).toEqual(['cmd', '', '', '--flag=a b', 'premidend'])

            expect(
                parseOverride(
                    {
                        command:
                            'sh -ec "set -e\necho \\"line 1\\"\nprintf \'a\\nb\'\nexec node app.js"',
                    },
                    'standard'
                )?.TaskTemplate.ContainerSpec.Args
            ).toEqual([
                'sh',
                '-ec',
                'set -e\necho "line 1"\nprintf \'a\\nb\'\nexec node app.js',
            ])
        })

        test('preserves empty string arguments in array form and single quotes', () => {
            expect(
                parseOverride(
                    {
                        entrypoint: ['/usr/bin/probe'],
                        command: [''],
                    },
                    'standard'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: ['/usr/bin/probe'],
                        Args: [''],
                    },
                },
            })

            expect(
                parseOverride(
                    {
                        entrypoint: ['/usr/bin/probe'],
                        command: '""',
                    },
                    'standard'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: ['/usr/bin/probe'],
                        Args: [''],
                    },
                },
            })
        })

        test('preserves shell operators and variable references without host expansion', () => {
            process.env.CAPROVER_COMMAND_TEST_SECRET = 'host-secret'
            try {
                expect(
                    parseOverride(
                        {
                            command:
                                'sh -c "echo $CAPROVER_COMMAND_TEST_SECRET && echo ${OTHER} | cat > /tmp/out; true"',
                        },
                        'standard'
                    )?.TaskTemplate.ContainerSpec.Args
                ).toEqual([
                    'sh',
                    '-c',
                    'echo $CAPROVER_COMMAND_TEST_SECRET && echo ${OTHER} | cat > /tmp/out; true',
                ])

                expect(
                    parseOverride(
                        {
                            command:
                                'echo a && echo b | cat > /tmp/x ; echo $CAPROVER_COMMAND_TEST_SECRET',
                        },
                        'standard'
                    )?.TaskTemplate.ContainerSpec.Args
                ).toEqual([
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
                ])
            } finally {
                delete process.env.CAPROVER_COMMAND_TEST_SECRET
            }
        })

        test('preserves exact argument boundaries for array-form inputs', () => {
            expect(
                parseOverride(
                    {
                        entrypoint: ['/bin/sh', '-c'],
                        command: ['  spaced  arg  ', '', '$HOME', 'a && b'],
                    },
                    'standard'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Command: ['/bin/sh', '-c'],
                        Args: ['  spaced  arg  ', '', '$HOME', 'a && b'],
                    },
                },
            })
        })

        test.each([
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
        ])(
            'rejects invalid syntax or types: %j',
            (service, expectedMessage) => {
                expect(() =>
                    parseOverride(
                        service as unknown as IDockerComposeService,
                        'standard',
                        'services.my-app'
                    )
                ).toThrow(expectedMessage)
            }
        )

        test('coexists with hostname and cap_add overrides', () => {
            expect(
                parseOverride(
                    {
                        hostname: ' worker-1 ',
                        cap_add: ['net_admin', 'CAP_SYS_TIME'],
                        entrypoint: ['/bin/sh', '-ec'],
                        command: ['exec app'],
                    },
                    'standard'
                )
            ).toEqual({
                TaskTemplate: {
                    ContainerSpec: {
                        Hostname: 'worker-1',
                        CapabilityAdd: ['CAP_NET_ADMIN', 'CAP_SYS_TIME'],
                        Command: ['/bin/sh', '-ec'],
                        Args: ['exec app'],
                    },
                },
            })
        })
    })
})
