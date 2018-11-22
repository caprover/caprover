import ApiStatusCode = require('./ApiStatusCodes');

class BaseApi {
    public data:any;
    constructor(private status:number, private description:string) {
        //
    }
}

export = BaseApi;