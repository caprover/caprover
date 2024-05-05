export interface IAutomatedCleanupConfigs {
    mostRecentLimit: number
    cronSchedule: string
    timezone: string
}

export class AutomatedCleanupConfigsCleaner {
    static cleanup(instance: IAutomatedCleanupConfigs) {
        return {
            mostRecentLimit:
                Number(instance.mostRecentLimit) > 0
                    ? Number(instance.mostRecentLimit)
                    : 1,
            cronSchedule: `${instance.cronSchedule || ''}`.trim(),
            timezone: `${instance.timezone || ''}`.trim() || 'UTC',
        }
    }
}
