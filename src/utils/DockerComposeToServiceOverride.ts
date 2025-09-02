import * as yaml from 'yaml'
import { IDockerComposeService } from '../models/IOneClickAppModels'
import Utils from './Utils'

export default class DockerComposeToServiceOverride {
    /**
     * Converts the unsupported docker compose parameters to CapRover service override definition.
     * Port, replicas, env vars, volumes, and image are supplied through CapRover definition,
     * network will be set to captain-overlay restart_policy is not generally needed,
     * by default docker services restart automatically.
     * Only parse parameters that are not from the aforementioned list.
     * The only useful parameter that we are parsing at the moment is hostname: https://github.com/caprover/caprover/issues/404
     *
     * @param docker compose service definition
     * @returns the override service definition in yaml format
     */
    static convertUnconsumedComposeParametersToServiceOverride(
        compose: IDockerComposeService
    ) {
        const overrides = [] as any[]
        overrides.push(DockerComposeToServiceOverride.parseHostname(compose))
        overrides.push(DockerComposeToServiceOverride.parseCapAdd(compose))
        overrides.push(DockerComposeToServiceOverride.parseCommand(compose))
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

    private static parseCommand(compose: IDockerComposeService) {
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
