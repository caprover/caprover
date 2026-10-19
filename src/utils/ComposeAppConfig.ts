import { isDockerVolumeNameAllowed } from '../datastore/AppsDataStore'
import { IAppDef, IAppPort, IAppVolume } from '../models/AppDefinition'
import { IDockerComposeService } from '../models/IOneClickAppModels'

// Compose syntax: https://docs.docker.com/reference/compose-file/services/
// Convert only fields represented by CapRover's existing app definition.
export default function composeAppConfig(
    service: IDockerComposeService,
    path = 'service'
): Pick<IAppDef, 'envVars' | 'volumes' | 'ports'> {
    if (!service || typeof service !== 'object' || Array.isArray(service)) {
        throw new Error(`${path}: expected a service mapping`)
    }
    const environmentPath = `${path}.environment`
    const environment = service.environment ?? {}
    const env = new Map<string, string>()
    const setEnv = (key: string, value: unknown, entryPath: string) => {
        if (!key || key.includes('=') || key.includes('\0')) {
            throw new Error(`${entryPath}: expected a non-empty variable name`)
        }
        // There is no caller shell to resolve unset values. Never read the
        // CapRover server's process.env when a template contains a bare key.
        if (value === null || value === undefined) {
            env.delete(key)
        } else if (['string', 'number', 'boolean'].includes(typeof value)) {
            env.set(key, String(value))
        } else {
            throw new Error(`${entryPath}: expected scalar variable values`)
        }
    }
    if (Array.isArray(environment)) {
        environment.forEach((entry, index) => {
            const entryPath = `${environmentPath}[${index}]`
            if (typeof entry !== 'string') {
                throw new Error(`${entryPath}: expected KEY=value strings`)
            }
            const equals = entry.indexOf('=')
            setEnv(
                equals < 0 ? entry : entry.slice(0, equals),
                equals < 0 ? null : entry.slice(equals + 1),
                entryPath
            )
        })
    } else if (environment && typeof environment === 'object') {
        Object.entries(environment).forEach(([key, value]) =>
            setEnv(key, value, `${environmentPath}.${key}`)
        )
    } else {
        throw new Error(`${environmentPath}: expected a map or a list`)
    }

    const volumes = service.volumes ?? []
    if (!Array.isArray(volumes)) {
        throw new Error(
            `${path}.volumes: expected a list of strings or objects`
        )
    }
    const appVolumes = volumes.map((entry, index): IAppVolume => {
        const entryPath = `${path}.volumes[${index}]`
        let source: string
        let target: string
        let type: string
        if (typeof entry === 'string') {
            const parts = entry.split(':')
            if (parts.length < 2 || parts.length > 3) {
                throw new Error(
                    `${entryPath}: expected source:target[:options]`
                )
            }
            // Existing One-Click templates use suffixes such as :ro. The
            // legacy parser accepted and ignored them; preserve that behavior.
            // Long-form options remain explicit about unsupported semantics.
            ;[source, target] = parts
            type = source.startsWith('/') ? 'bind' : 'volume'
        } else if (
            entry &&
            typeof entry === 'object' &&
            !Array.isArray(entry)
        ) {
            checkKeys(
                entry,
                ['type', 'source', 'target', 'read_only'],
                entryPath
            )
            if (entry.read_only !== undefined && entry.read_only !== false) {
                throw new Error(
                    `${entryPath}.read_only: read_only mounts are not supported by CapRover`
                )
            }
            ;({ source, target, type } = entry)
        } else {
            throw new Error(`${entryPath}: expected a string or object`)
        }
        if (type !== 'bind' && type !== 'volume') {
            throw new Error(
                `${entryPath}.type: only volume and bind mounts are supported`
            )
        }
        if (typeof source !== 'string' || !source) {
            throw new Error(`${entryPath}.source: a source is required`)
        }
        if (typeof target !== 'string' || !target.startsWith('/')) {
            throw new Error(
                `${entryPath}.target: an absolute target path is required`
            )
        }
        if (type === 'bind' && source.startsWith('/')) {
            return { hostPath: source, containerPath: target }
        }
        if (type === 'volume' && isDockerVolumeNameAllowed(source)) {
            return { volumeName: source, containerPath: target }
        }
        throw new Error(
            `${entryPath}.source: use a named volume or an absolute bind source path`
        )
    })

    const ports = service.ports ?? []
    if (!Array.isArray(ports)) {
        throw new Error(`${path}.ports: expected a list of strings or objects`)
    }
    const appPorts = ports.map((entry, index): IAppPort => {
        const entryPath = `${path}.ports[${index}]`
        let published: unknown
        let target: unknown
        let protocol: unknown
        let mode: unknown
        if (typeof entry === 'string') {
            const match = /^(\d+):(\d+)(?:\/(tcp|udp))?$/.exec(entry)
            if (!match) {
                throw new Error(
                    `${entryPath}: expected published:target[/tcp|udp]; host IPs, ranges and automatic ports are not supported`
                )
            }
            ;[, published, target, protocol] = match
        } else if (
            entry &&
            typeof entry === 'object' &&
            !Array.isArray(entry)
        ) {
            checkKeys(
                entry,
                [
                    'published',
                    'target',
                    'protocol',
                    'mode',
                    'name',
                    'app_protocol',
                ],
                entryPath
            )
            ;({ published, target, protocol, mode } = entry)
        } else {
            throw new Error(`${entryPath}: expected a string or object`)
        }
        if (
            protocol !== undefined &&
            protocol !== 'tcp' &&
            protocol !== 'udp'
        ) {
            throw new Error(
                `${entryPath}.protocol: protocol must be tcp or udp`
            )
        }
        if (mode !== undefined && mode !== 'ingress' && mode !== 'host') {
            throw new Error(`${entryPath}.mode: mode must be ingress or host`)
        }
        return {
            hostPort: portNumber(published, `${entryPath}.published`),
            containerPort: portNumber(target, `${entryPath}.target`),
            // Omission preserves CapRover's existing TCP + UDP behavior.
            ...(protocol ? { protocol: protocol as 'tcp' | 'udp' } : {}),
            ...(mode ? { publishMode: mode as 'ingress' | 'host' } : {}),
        }
    })
    return {
        envVars: Array.from(env, ([key, value]) => ({ key, value })),
        volumes: appVolumes,
        ports: appPorts,
    }
}

function checkKeys(value: object, allowed: string[], field: string) {
    for (const key of Object.keys(value)) {
        if (!allowed.includes(key)) {
            throw new Error(
                `${field}.${key}: option ${key} is not supported by CapRover`
            )
        }
    }
}

function portNumber(value: unknown, path: string): number {
    if (
        (typeof value !== 'string' && typeof value !== 'number') ||
        !/^\d+$/.test(String(value)) ||
        Number(value) < 1 ||
        Number(value) >= 65535
    ) {
        throw new Error(
            `${path}: published and target must be port numbers between 1 and 65534`
        )
    }
    return Number(value)
}
