class BaseApi {
    public data: any

    constructor(public status: number, public description: string) {
        this.data = {}
    }
}

export default BaseApi
