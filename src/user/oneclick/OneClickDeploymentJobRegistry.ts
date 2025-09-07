import Logger from '../../utils/Logger'

export interface IDeploymentState {
    steps: string[]
    error: string
    successMessage?: string
    currentStep: number
}

interface IJobInfo {
    jobId: string
    state: IDeploymentState
    createdAt: Date
    updatedAt: Date
}

/**
 * In-memory registry for tracking one-click deployment job progress
 */
export class OneClickDeploymentJobRegistry {
    private static instance: OneClickDeploymentJobRegistry
    private jobs: Map<string, IJobInfo> = new Map()
    private cleanupInterval: NodeJS.Timeout | null = null

    private constructor() {
        this.startAutomaticCleanup()
    }

    public static getInstance(): OneClickDeploymentJobRegistry {
        if (!OneClickDeploymentJobRegistry.instance) {
            OneClickDeploymentJobRegistry.instance =
                new OneClickDeploymentJobRegistry()
        }
        return OneClickDeploymentJobRegistry.instance
    }

    /**
     * Generate a unique job ID
     */
    private generateJobId(): string {
        return `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * Create a new deployment job with initial state
     * Returns the generated job ID
     */
    public createJob(): string {
        const jobId = this.generateJobId()
        const initialState: IDeploymentState = {
            steps: ['Queuing deployment'],
            currentStep: 0,
            error: '',
            successMessage: '',
        }

        const jobInfo: IJobInfo = {
            jobId,
            state: initialState,
            createdAt: new Date(),
            updatedAt: new Date(),
        }

        this.jobs.set(jobId, jobInfo)
        return jobId
    }

    /**
     * Update the progress of a deployment job
     */
    public updateJobProgress(
        jobId: string,
        newState: IDeploymentState
    ): boolean {
        const jobInfo = this.jobs.get(jobId)
        if (!jobInfo) {
            return false
        }
        jobInfo.state = newState
        jobInfo.updatedAt = new Date()

        this.jobs.set(jobId, jobInfo)
        return true
    }

    /**
     * Get the current state of a deployment job
     */
    public getJobState(jobId: string): IDeploymentState | null {
        const jobInfo = this.jobs.get(jobId)
        return jobInfo ? jobInfo.state : null
    }

    /**
     * Check if a job exists
     */
    public jobExists(jobId: string): boolean {
        return this.jobs.has(jobId)
    }

    /**
     * Remove a job from tracking (cleanup)
     */
    public removeJob(jobId: string): boolean {
        return this.jobs.delete(jobId)
    }

    /**
     * Get all job IDs (for debugging/admin purposes)
     */
    public getAllJobIds(): string[] {
        return Array.from(this.jobs.keys())
    }

    /**
     * Clean up old jobs (older than specified hours)
     */
    cleanupOldJobs(olderThanHours: number = 24): number {
        const cutoffTime = new Date()
        cutoffTime.setHours(cutoffTime.getHours() - olderThanHours)

        let removedCount = 0
        for (const [jobId, jobInfo] of this.jobs.entries()) {
            if (jobInfo.updatedAt < cutoffTime) {
                this.jobs.delete(jobId)
                removedCount++
            }
        }

        return removedCount
    }

    /**
     * Start automatic cleanup that runs every 4 hours
     */
    private startAutomaticCleanup(): void {
        // Clean up jobs older than 24 hours every 4 hours (4 * 60 * 60 * 1000 ms)
        this.cleanupInterval = setInterval(
            () => {
                const removedCount = this.cleanupOldJobs(24)
                if (removedCount > 0) {
                    Logger.d(
                        `OneClick deployment cleanup: removed ${removedCount} old job(s)`
                    )
                }
            },
            4 * 60 * 60 * 1000
        )
    }
}
