import ApiStatusCode = require('./ApiStatusCodes');

class BaseApi {
    constructor(private status:number, private description:string) {
        //
    }
}

export = BaseApi;