export default class Utils {
    static removeHttpHttps(input: string) {
        input = input.trim()
        input = input.replace(/^(?:http?:\/\/)?/i, '')
        input = input.replace(/^(?:https?:\/\/)?/i, '')
        return input
    }
    static isNotGetRequest(req: { method: string }) {
        return req.method !== 'GET'
    }
}
