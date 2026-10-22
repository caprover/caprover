export type DiskUsageSeverity = 'normal' | 'warning' | 'critical'

export interface DiskUsageDisk {
    totalBytes: number
    usedBytes: number
    availableBytes: number
    severity: DiskUsageSeverity
}

export interface DiskUsageNode {
    nodeId: string
    hostname: string
    disks: DiskUsageDisk[]
}

/**
 * Capacity of the filesystem backing the configured Captain base directory on
 * the node hosting CapRover. Includes all usage on that filesystem. Separate
 * Docker data or application filesystems are outside this response's coverage.
 */
export interface DiskUsageResponse {
    coverage: 'captain-node'
    nodes: DiskUsageNode[]
}
