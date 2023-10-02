import EnvVars from '../../../utils/EnvVars'
import ProManager from '../../pro/ProManager'
import { CapRoverEventType, ICapRoverEvent } from '../ICapRoverEvent'
import { IEventsEmitter } from '../IEventsEmitter'

export class AnalyticsLogger extends IEventsEmitter {
    constructor(private proManager: ProManager) {
        super()
    }
    isEventApplicable(event: ICapRoverEvent): boolean {
        return false
    }

    emitEvent(event: ICapRoverEvent): void {
    }
}
