/**
 * Content of this file is mostly taken from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
 */
import crypto = require('crypto')

const algorithm = 'aes-256-ctr'
const IV_LENGTH = 16 // For AES, this is always 16

export class CaptainEncryptor {
    constructor(private encryptionKey: string) {
        if (!encryptionKey || encryptionKey.length < 32) {
            throw new Error('Encryption Key too short!')
        }
        encryptionKey = encryptionKey.slice(0, 32)
    }

    encrypt(clearText: string) {
        const self = this

        let iv = crypto.randomBytes(IV_LENGTH)
        let key = new Buffer(self.encryptionKey)
        let cipher = crypto.createCipheriv(algorithm, key, iv)
        let encrypted = cipher.update(clearText)

        encrypted = Buffer.concat([encrypted, cipher.final()])

        return iv.toString('hex') + ':' + encrypted.toString('hex')
    }

    decrypt(text: string) {
        const self = this
        text = text + ''

        let textParts = text.split(':')
        let shifted = textParts.shift()
        if (!shifted) throw new Error('text.split failed')

        let iv = new Buffer(shifted, 'hex')
        let encryptedText = new Buffer(textParts.join(':'), 'hex')
        let key = new Buffer(self.encryptionKey)
        let decipher = crypto.createDecipheriv(algorithm, key, iv)
        let decrypted = decipher.update(encryptedText)

        decrypted = Buffer.concat([decrypted, decipher.final()])

        return decrypted.toString()
    }
}
