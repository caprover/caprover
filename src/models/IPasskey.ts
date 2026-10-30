export interface IPasskeySaved {
    id: string // base64url credential ID
    publicKey: string // base64url COSE public key
    counter: number
    transports: string[]
    name: string
    createdAt: string // ISO date
    lastUsedAt?: string // ISO date
}

export interface IPasskeySummary {
    id: string
    name: string
    createdAt: string
    lastUsedAt?: string
}
