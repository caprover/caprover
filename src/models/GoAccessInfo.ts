export class GoAccessInfo {
    public isEnabled: boolean
    public data: {
        rotationFrequencyCron: string
        catchupFrequencyCron: string
        logRetentionDays?: number
    }
}
