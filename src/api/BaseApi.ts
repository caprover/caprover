class BaseApi {
    public data: any

    constructor(private status: number, private description: string) {
        this.data = {}
    }
}

export default BaseApi
