import {
    IProConfig,
    ProAlertActionType,
    ProAlertEvent,
} from '../../models/IProFeatures'

export default class ProManagerUtils {
    public static ensureProConfigType(pc: any) {
        pc = pc || {}
        const proConfig: IProConfig = {
            alerts: [],
        }

        if (pc.alerts && Array.isArray(pc.alerts)) {
            const alerts = pc.alerts as any[]
            alerts.forEach((it) => {
                const event = `${it.event}`.trim()
                if (event) {
                    proConfig.alerts.push({
                        event: event as ProAlertEvent,
                        action: {
                            actionType:
                                `${it.action.actionType}`.trim() as ProAlertActionType,
                            metadata: it.action.metadata,
                        },
                    })
                }
            })
        }

        return proConfig
    }
}
