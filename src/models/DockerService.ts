export interface Version {
    Index: number
}

export interface Labels {}

export interface Mount {
    Type: string
    Source: string
    Target: string
}

export interface ContainerSpecType {
    Image: string
    Env: string[]
    Mounts: Mount[]
    Isolation: string
}

export interface Resources {}

export interface Placement {
    Constraints: string[]
}

export interface Options {
    'max-size': string
}

export interface LogDriver {
    Name: string
    Options: Options
}

export interface TaskTemplate {
    ContainerSpec: ContainerSpecType
    Resources: Resources
    Placement: Placement
    LogDriver: LogDriver
    ForceUpdate: number
    Runtime: string
}

export interface Replicated {
    Replicas: number
}

export interface Mode {
    Replicated: Replicated
}

export interface Port {
    Protocol: string
    TargetPort: number
    PublishedPort: number
    PublishMode: string
}

export interface EndpointSpec {
    Mode: string
    Ports: Port[]
}

export interface Spec {
    Name: string
    Labels: Labels
    TaskTemplate: TaskTemplate
    Mode: Mode
    EndpointSpec: EndpointSpec
}

export interface PreviousSpec {
    Name: string
    Labels: Labels
    TaskTemplate: TaskTemplate
    Mode: Mode
    EndpointSpec: EndpointSpec
}

export interface VirtualIP {
    NetworkID: string
    Addr: string
}

export interface Endpoint {
    Spec: Spec
    Ports: Port[]
    VirtualIPs: VirtualIP[]
}

export interface UpdateStatus {
    State: string
    StartedAt: string
    Message: string
}

export default interface DockerService {
    ID: string
    Version: Version
    CreatedAt: string
    UpdatedAt: string
    Spec: Spec
    PreviousSpec: PreviousSpec
    Endpoint: Endpoint
    UpdateStatus: UpdateStatus
}
