import crypto = require('crypto')

/**
 * Content of this file is mostly taken from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
 */

const algorithm = 'aes-256-ctr'
const IV_LENGTH = 16 // For AES, this is always 16

export default class CaptainEncryptor {
    private encryptionKey: string

    constructor(encryptionKey: string) {
        if (!encryptionKey || encryptionKey.length < 32) {
            throw new Error('Encryption Key too short!')
        }

        encryptionKey = crypto
            .createHash('sha256')
            .update(encryptionKey)
            .digest('hex')

        if (!encryptionKey || encryptionKey.length < 32) {
            throw new Error('Encryption Key too short after hashing!')
        }

        this.encryptionKey = encryptionKey.slice(0, 32)
    }

    encrypt(clearText: string) {
        const self = this

        const iv = crypto.randomBytes(IV_LENGTH)
        const key = Buffer.from(self.encryptionKey)
        const cipher = crypto.createCipheriv(algorithm, key, iv)
        let encrypted = cipher.update(clearText)

        encrypted = Buffer.concat([encrypted, cipher.final()])

        return `${iv.toString('hex')}:${encrypted.toString('hex')}`
    }

    decrypt(text: string) {
        const self = this
        text = text + ''

        const textParts = text.split(':')
        const shifted = textParts.shift()
        if (!shifted) throw new Error('text.split failed')

        const iv = Buffer.from(shifted, 'hex')
        const encryptedText = Buffer.from(textParts.join(':'), 'hex')
        const key = Buffer.from(self.encryptionKey)
        const decipher = crypto.createDecipheriv(algorithm, key, iv)
        let decrypted = decipher.update(encryptedText)

        decrypted = Buffer.concat([decrypted, decipher.final()])

        return decrypted.toString()
    }
}
