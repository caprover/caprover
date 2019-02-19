export interface RestoringNode {
    oldIp: string
    newIp: string
    user: string
    privateKeyPath: string
}

export interface OldNodesForReference {
    appsLockOnThisNode: string[]

    nodeData: ServerDockerInfo
}

export interface RestoringInfo {
    nodesMapping: RestoringNode[]

    oldNodesForReference: OldNodesForReference[]
}

export interface BackupMeta {
    salt: string

    nodes: ServerDockerInfo[]
}
