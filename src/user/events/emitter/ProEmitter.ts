import ProManager from '../../pro/ProManager'
import { ICapRoverEvent } from '../ICapRoverEvent'
import { IEventsEmitter } from '../IEventsEmitter'

export class ProEmitter extends IEventsEmitter {
    constructor(private proManager: ProManager) {
        super()
    }
    isEventApplicable(event: ICapRoverEvent): boolean {
        return this.proManager.isEventEnabledForProReporting(event)
    }

    emitEvent(event: ICapRoverEvent): void {
        const self = this
        Promise.resolve()
            .then(function () {
                return self.proManager.getState()
            })
            .then(function (state) {
                if (state.isSubscribed) {
                    self.proManager.reportEvent(event)
                }
            })
    }
}
