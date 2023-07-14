import ProManager from '../pro/ProManager'
import { AnalyticsLogger } from './emitter/AnalyticsLogger'
import { ProEmitter } from './emitter/ProEmitter'
import { ICapRoverEvent } from './ICapRoverEvent'
import { IEventsEmitter } from './IEventsEmitter'

export class EventLogger {
    constructor(private eventEmitters: IEventsEmitter[]) {}

    trackEvent(event: ICapRoverEvent) {
        this.eventEmitters.forEach((ee) => {
            if (ee.isEventApplicable(event)) {
                ee.emitEvent(event)
            }
        })
    }
}

export class EventLoggerFactory {
    private static instance: EventLoggerFactory

    private logger: EventLogger

    constructor(proManger: ProManager) {
        this.logger = new EventLogger([
            new AnalyticsLogger(proManger),
            new ProEmitter(proManger),
        ])
    }

    static get(proManger: ProManager) {
        if (!EventLoggerFactory.instance) {
            EventLoggerFactory.instance = new EventLoggerFactory(proManger)
        }
        return EventLoggerFactory.instance
    }

    getLogger() {
        return this.logger
    }
}
