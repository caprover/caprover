class NetDataInfo {
    public isEnabled: boolean
    public data: {
        smtp: {
            to: string
            hostname: string
            server: string
            port: string
            allowNonTls: string
            username: string
            password: string
        }
        slack: {
            hook: string
            channel: string
        }
        telegram: {
            chatId: string
            botToken: string
        }
        pushBullet: {
            apiToken: string
            fallbackEmail: string
        }
    }
}
