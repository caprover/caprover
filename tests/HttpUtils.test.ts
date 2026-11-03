import axios from 'axios'
import { getText } from '../src/utils/HttpUtils'

jest.mock('axios')

const mockedAxios = axios as jest.Mocked<typeof axios>

describe('HttpUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('returns the response body as text', async () => {
        mockedAxios.get.mockResolvedValue({ data: 'response body' })

        await expect(getText('https://example.com')).resolves.toBe(
            'response body'
        )

        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://example.com',
            expect.objectContaining({ responseType: 'text' })
        )
    })

    test('preserves response bodies for every HTTP status', async () => {
        mockedAxios.get.mockResolvedValue({ data: 'not found' })

        await expect(getText('https://example.com/missing')).resolves.toBe(
            'not found'
        )

        const config = mockedAxios.get.mock.calls[0][1]
        expect(config?.validateStatus?.(404)).toBe(true)
    })

    test('rejects network failures', async () => {
        const error = new Error('network failure')
        mockedAxios.get.mockRejectedValue(error)

        await expect(getText('https://example.com')).rejects.toBe(error)
    })
})
