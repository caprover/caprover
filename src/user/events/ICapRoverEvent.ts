export enum CapRoverEventType {
    UserLoggedIn = 'UserLoggedIn',
    AppBuildSuccessful = 'AppBuildSuccessful',
    AppBuildFailed = 'AppBuildFailed',
    InstanceStarted = 'InstanceStarted',
    OneClickAppDetailsFetched = 'OneClickAppDetailsFetched',
    OneClickAppListFetched = 'OneClickAppListFetched',
    OneClickAppDeployStarted = 'OneClickAppDeployStarted',
}

export interface ICapRoverEvent {
    eventType: CapRoverEventType
    eventMetadata: any
}

export class CapRoverEventFactory {
    static create(
        eventType: CapRoverEventType,
        eventMetadata: any
    ): ICapRoverEvent {
        return {
            eventType,
            eventMetadata,
        }
    }
}
