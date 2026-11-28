import * as yaml from 'yaml'
import { IDockerComposeService } from '../models/IOneClickAppModels'
import Utils from './Utils'

export type ComposeExecutionSemantics = 'legacy' | 'standard'

export const DOCKER_COMPOSE_TEMPLATE_NAME = 'DOCKER_COMPOSE'

const MAX_SUPPORTED_CAPTAIN_VERSION = 5
const STANDARD_SEMANTICS_MIN_CAPTAIN_VERSION = 5

type ParsedComposeCommandField =
    | { kind: 'inherit' }
    | { kind: 'clear' }
    | { kind: 'values'; values: string[] }

export function resolveComposeExecutionSemantics(
    captainVersion: unknown,
    templateName?: unknown
): ComposeExecutionSemantics {
    const isDirectCompose = templateName === DOCKER_COMPOSE_TEMPLATE_NAME

    if (
        captainVersion === undefined ||
        captainVersion === null ||
        captainVersion === ''
    ) {
        return isDirectCompose ? 'standard' : 'legacy'
    }

    const parsedVersion =
        typeof captainVersion === 'number'
            ? captainVersion
            : typeof captainVersion === 'string' &&
                /^\d+$/.test(captainVersion.trim())
              ? Number(captainVersion.trim())
              : NaN

    if (
        !Number.isInteger(parsedVersion) ||
        parsedVersion < 1 ||
        parsedVersion > MAX_SUPPORTED_CAPTAIN_VERSION
    ) {
        throw new Error(
            `Unsupported captainVersion: ${captainVersion}. Supported versions are up to ${MAX_SUPPORTED_CAPTAIN_VERSION}.`
        )
    }

    if (
        parsedVersion >= STANDARD_SEMANTICS_MIN_CAPTAIN_VERSION ||
        isDirectCompose
    ) {
        return 'standard'
    }

    return 'legacy'
}

export default class DockerComposeToServiceOverride {
    /**
     * Converts the unsupported docker compose parameters to CapRover service override definition.
     * Port, replicas, env vars, volumes, and image are supplied through CapRover definition,
     * network will be set to captain-overlay restart_policy is not generally needed,
     * by default docker services restart automatically.
     * Only parse parameters that are not from the aforementioned list.
     *
     * @param compose docker compose service definition
     * @param executionSemantics legacy (v4 and older One-Click templates) or standard (v5 and direct Compose)
     * @param path field path prefix used in validation error messages
     * @returns the override service definition in yaml format
     */
    static convertUnconsumedComposeParametersToServiceOverride(
        compose: IDockerComposeService,
        executionSemantics: ComposeExecutionSemantics,
        path = 'service'
    ) {
        const overrides = [] as any[]
        overrides.push(DockerComposeToServiceOverride.parseHostname(compose))
        overrides.push(DockerComposeToServiceOverride.parseCapAdd(compose))
        overrides.push(
            executionSemantics === 'standard'
                ? DockerComposeToServiceOverride.parseStandardCommandAndEntrypoint(
                      compose,
                      path
                  )
                : DockerComposeToServiceOverride.parseLegacyCommand(compose)
        )
        // Add more overrides here if needed

        let mergedOverride = {} as any
        overrides.forEach((o) => {
            mergedOverride = Utils.mergeObjects(mergedOverride, o)
        })
        if (Object.keys(mergedOverride).length === 0) {
            return undefined
        }

        return yaml.stringify(mergedOverride)
    }

    /**
     * Legacy One-Click templates (captainVersion <= 4) rely on `command` mapping to
     * Swarm ContainerSpec.Command, ignoring `entrypoint`, and using the historical
     * regex-based string tokenizer. Keep this isolated so v4 catalogs remain compatible.
     */
    private static parseLegacyCommand(compose: IDockerComposeService) {
        const override = {} as any

        function parseDockerCMD(cmdString: string) {
            // Matches sequences inside quotes or sequences without spaces
            const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
            let match
            const args = []

            while ((match = regex.exec(cmdString))) {
                // If matched quotes, add the first group that is not undefined
                if (match[1]) {
                    args.push(match[1])
                } else if (match[2]) {
                    args.push(match[2])
                } else {
                    args.push(match[0])
                }
            }

            return args
        }

        if (compose.command) {
            override.TaskTemplate = {
                ContainerSpec: {
                    Command: Array.isArray(compose.command)
                        ? compose.command
                        : parseDockerCMD(compose.command),
                },
            }
        }

        return override
    }

    private static parseStandardCommandAndEntrypoint(
        compose: IDockerComposeService,
        path: string
    ) {
        // Compose entrypoint maps to Swarm Command.
        // Compose command maps to Swarm Args (the image's CMD).
        const entrypoint = parseStandardCommandField(
            compose.entrypoint,
            `${path}.entrypoint`,
            true
        )
        const command = parseStandardCommandField(
            compose.command,
            `${path}.command`,
            false
        )

        const containerSpec: { Command?: string[]; Args?: string[] } = {}

        if (entrypoint.kind === 'inherit') {
            if (command.kind === 'clear') {
                throw new Error(
                    `${path}.command: clearing the image default command without setting entrypoint is not supported by Docker Swarm`
                )
            }
            if (command.kind === 'values') {
                containerSpec.Args = command.values
            }
        } else if (entrypoint.kind === 'values') {
            containerSpec.Command = entrypoint.values
            // Overriding Swarm Command without Args suppresses the image's default CMD,
            // which matches Compose for both omitted/null and explicitly cleared command.
            if (command.kind === 'values') {
                containerSpec.Args = command.values
            }
        } else {
            // entrypoint.kind === 'clear'
            if (command.kind === 'clear') {
                throw new Error(
                    `${path}.entrypoint: clearing both entrypoint and command leaves no command to execute`
                )
            }
            if (command.kind === 'inherit') {
                throw new Error(
                    `${path}.entrypoint: clearing the image default entrypoint requires an explicit non-empty command in Docker Swarm`
                )
            }
            // Swarm skips empty Command slices, so pass [""] which Docker Engine
            // uses to suppress image ENTRYPOINT/CMD inheritance and then resets to nil.
            containerSpec.Command = ['']
            containerSpec.Args = command.values
        }

        if (Object.keys(containerSpec).length === 0) {
            return {}
        }

        return {
            TaskTemplate: {
                ContainerSpec: containerSpec,
            },
        }
    }

    private static parseHostname(compose: IDockerComposeService) {
        const override = {} as any
        const hostname = compose.hostname ? `${compose.hostname}`.trim() : ''
        if (compose.hostname) {
            override.TaskTemplate = {
                ContainerSpec: {
                    Hostname: hostname,
                },
            }
        }

        return override
    }

    private static parseCapAdd(compose: IDockerComposeService) {
        const override = {} as any
        if (!!compose.cap_add && Array.isArray(compose.cap_add)) {
            const capabilityAdd = compose.cap_add
                .map((cap) => cap.toUpperCase())
                .map((cap) => (cap.startsWith(`CAP`) ? cap : `CAP_${cap}`))
            override.TaskTemplate = {
                ContainerSpec: {
                    CapabilityAdd: capabilityAdd,
                },
            }
        }

        return override
    }
}

function parseStandardCommandField(
    rawValue: unknown,
    fieldPath: string,
    treatSingleEmptyAsClear: boolean
): ParsedComposeCommandField {
    if (rawValue === undefined || rawValue === null) {
        return { kind: 'inherit' }
    }

    let values: string[]
    if (typeof rawValue === 'string') {
        values = parseComposeCommandString(rawValue, fieldPath)
    } else if (Array.isArray(rawValue)) {
        values = rawValue.map((entry, index) => {
            if (typeof entry !== 'string') {
                throw new Error(`${fieldPath}[${index}]: expected a string`)
            }
            return entry
        })
    } else {
        throw new Error(
            `${fieldPath}: expected a string or an array of strings`
        )
    }

    if (
        values.length === 0 ||
        (treatSingleEmptyAsClear && values.length === 1 && values[0] === '')
    ) {
        return { kind: 'clear' }
    }

    return { kind: 'values', values }
}

function parseComposeCommandString(raw: string, fieldPath: string): string[] {
    const args: string[] = []
    let current = ''
    let hasToken = false
    let quote: "'" | '"' | null = null

    const flush = () => {
        if (hasToken) {
            args.push(current)
            current = ''
            hasToken = false
        }
    }

    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i]

        if (quote === "'") {
            if (ch === "'") {
                quote = null
            } else {
                current += ch
            }
            continue
        }

        if (quote === '"') {
            if (ch === '"') {
                quote = null
            } else if (ch === '\\') {
                if (i + 1 >= raw.length) {
                    throw new Error(`${fieldPath}: unterminated double quote`)
                }
                const next = raw[i + 1]
                if (next === '\n') {
                    i++
                } else if (next === '\r' && raw[i + 2] === '\n') {
                    i += 2
                } else if (
                    next === '"' ||
                    next === '\\' ||
                    next === '$' ||
                    next === '`'
                ) {
                    current += next
                    i++
                } else {
                    current += '\\'
                }
            } else {
                current += ch
            }
            continue
        }

        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            flush()
            continue
        }

        if (ch === "'" || ch === '"') {
            quote = ch
            hasToken = true
            continue
        }

        if (ch === '\\') {
            if (i + 1 >= raw.length) {
                throw new Error(`${fieldPath}: trailing escape character`)
            }
            const next = raw[i + 1]
            if (next === '\n') {
                i++
            } else if (next === '\r' && raw[i + 2] === '\n') {
                i += 2
            } else {
                current += next
                hasToken = true
                i++
            }
            continue
        }

        current += ch
        hasToken = true
    }

    if (quote === "'") {
        throw new Error(`${fieldPath}: unterminated single quote`)
    }
    if (quote === '"') {
        throw new Error(`${fieldPath}: unterminated double quote`)
    }

    flush()
    return args
}
