export class CaptainError extends Error {
    public captainErrorType: number
    public apiMessage: string

    constructor(code: number, msg: string) {
        super(msg)
        this.captainErrorType = code
        this.apiMessage = msg
    }
}
