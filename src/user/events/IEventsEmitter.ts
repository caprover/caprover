import { ICapRoverEvent } from './ICapRoverEvent'

export abstract class IEventsEmitter {
    abstract isEventApplicable(event: ICapRoverEvent): boolean
    abstract emitEvent(event: ICapRoverEvent): void
}
