export interface IProFeatures {
    isFeatureFlagEnabled: boolean
    isSubscribed: boolean
}

export interface TwoFactorAuthResponse {
    isEnabled: boolean
    otpPath?: string
}

export enum ProAlertActionType {
    email = 'email',
    webhook = 'webhook',
}

export interface ProAlertAction {
    actionType: ProAlertActionType
    metadata?: any
}

export enum ProAlertEvent {
    UserLoggedIn = 'UserLoggedIn',
    AppBuildSuccessful = 'AppBuildSuccessful',
    AppBuildFailed = 'AppBuildFailed',
}

export interface ProAlertConfig {
    event: ProAlertEvent
    action: ProAlertAction
}

export interface IProConfig {
    alerts: ProAlertConfig[]
}
