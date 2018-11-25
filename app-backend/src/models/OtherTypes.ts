export type CaptainError = {
    captainErrorType: number
    apiMessage: string
}

export type AnyError = any

export interface IDockerApiPort {
    Protocol: string
    TargetPort: number
    PublishedPort: number
    PublishMode?: 'ingress' | 'host'
}

export interface IDockerContainerResource {
    Limits?: { NanoCPUs?: number; MemoryBytes?: number }
    Reservation?: { NanoCPUs?: number; MemoryBytes?: number }
}
