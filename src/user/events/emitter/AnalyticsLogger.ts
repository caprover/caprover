import EnvVars from '../../../utils/EnvVars'
import ProManager from '../../pro/ProManager'
import { CapRoverEventType, ICapRoverEvent } from '../ICapRoverEvent'
import { IEventsEmitter } from '../IEventsEmitter'

export class AnalyticsLogger extends IEventsEmitter {
    constructor(private proManager: ProManager) {
        super()
    }
    isEventApplicable(event: ICapRoverEvent): boolean {
        if (EnvVars.CAPROVER_DISABLE_ANALYTICS) {
            return false
        }

        // some events aren't appropriate for usage stats
        switch (event.eventType) {
            case CapRoverEventType.AppBuildFailed:
            case CapRoverEventType.AppBuildSuccessful:
            case CapRoverEventType.UserLoggedIn: // perhaps anonymize the IP address and send it in the future
                return false

            case CapRoverEventType.InstanceStarted:
            case CapRoverEventType.OneClickAppDetailsFetched:
            case CapRoverEventType.OneClickAppListFetched:
                return true
        }
    }

    emitEvent(event: ICapRoverEvent): void {
        this.proManager.reportUnAuthAnalyticsEvent(event)
    }
}
