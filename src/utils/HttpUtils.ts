import axios from 'axios'

export function getText(url: string): Promise<string> {
    return axios
        .get<string>(url, {
            responseType: 'text',
            transformResponse: [(data) => data],
            validateStatus: () => true,
        })
        .then((response) => response.data)
}
