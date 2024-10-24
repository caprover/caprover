export interface CapRoverExtraTheme {
    siderTheme?: string
}

export default interface CapRoverTheme {
    content: string
    name: string
    extra?: string
    headEmbed?: string
    builtIn?: boolean
}
