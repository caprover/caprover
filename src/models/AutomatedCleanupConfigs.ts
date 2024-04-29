export interface IAutomatedCleanupConfigs {
    mostRecentLimit: number
    cronSchedule: string
    timezone: string
}

export class AutomatedCleanupConfigsCleaner {
    static cleanup(instance: IAutomatedCleanupConfigs) {
        return {
            mostRecentLimit: Number(instance.mostRecentLimit),
            cronSchedule: `${instance.cronSchedule || ''}`,
            timezone: `${instance.timezone || ''}`,
        }
    }
}
