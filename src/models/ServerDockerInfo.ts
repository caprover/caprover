interface ServerDockerInfo {
    nodeId: string
    type: string
    isLeader: boolean
    hostname: string
    architecture: string
    operatingSystem: string
    nanoCpu: number
    memoryBytes: number
    dockerEngineVersion: string
    ip: string
    state: string
    status: string
}
