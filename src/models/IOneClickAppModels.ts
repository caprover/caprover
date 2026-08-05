import { IHashMapGeneric } from './ICacheGeneric'

export interface IOneClickAppIdentifier {
    sortScore?: number // 0-1 and dynamically calculated based on search terms
    isOfficial?: boolean
    name: string
    displayName: string
    description: string
    logoUrl: string
    baseUrl: string
}

export interface IOneClickVariable {
    id: string
    label: string
    defaultValue?: string
    validRegex?: string
    description?: string
}

export interface IDockerComposeService {
    image?: string
    volumes?: string[]
    ports?: string[]
    environment?: IHashMapGeneric<string>
    depends_on?: string[]
    hostname?: string
    cap_add?: string[]
    command?: string | string[]

    // These are CapRover property, not DockerCompose. We use this instead of image if we need to extend the image.
    caproverExtra?: {
        dockerfileLines?: string[]
        containerHttpPort: number
        notExposeAsWebApp: boolean // This is actually a string "true", make sure to double negate!
        websocketSupport: boolean // This is actually a string "true", make sure to double negate!
    }
}

export interface IOneClickTemplate {
    services: IHashMapGeneric<IDockerComposeService>
    captainVersion: number
    caproverOneClickApp: {
        instructions: {
            start: string
            end: string
        }
        displayName: string
        variables: IOneClickVariable[]
    }
}
