import { handleDownloadCompletion } from '../src/routes/download/DownloadRouter'

describe('backup download completion', () => {
    test('returns 404 when the one-time backup file is already gone', () => {
        const sendStatus = jest.fn()
        const next = jest.fn()
        const response = {
            headersSent: false,
            sendStatus,
        }

        const error = Object.assign(new Error('missing backup'), {
            code: 'ENOENT',
        })

        handleDownloadCompletion(
            error,
            '/tmp/missing-caprover-backup.tar',
            response as any,
            next
        )

        expect(sendStatus).toHaveBeenCalledWith(404)
        expect(next).not.toHaveBeenCalled()
    })

    test('delegates other transfer errors', () => {
        const sendStatus = jest.fn()
        const next = jest.fn()
        const response = {
            headersSent: false,
            sendStatus,
        }
        const error = new Error('transfer failed')

        handleDownloadCompletion(
            error,
            '/tmp/missing-caprover-backup.tar',
            response as any,
            next
        )

        expect(sendStatus).not.toHaveBeenCalled()
        expect(next).toHaveBeenCalledWith(error)
    })
})
