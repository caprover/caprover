"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Content of this file is mostly taken from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
 */
const crypto = require("crypto");
const algorithm = 'aes-256-ctr';
const IV_LENGTH = 16; // For AES, this is always 16
class CaptainEncryptor {
    constructor(encryptionKey) {
        this.encryptionKey = encryptionKey;
        if (!encryptionKey || encryptionKey.length < 32) {
            throw new Error('Encryption Key too short!');
        }
        encryptionKey = encryptionKey.slice(0, 32);
    }
    encrypt(clearText) {
        const self = this;
        let iv = crypto.randomBytes(IV_LENGTH);
        let key = new Buffer(self.encryptionKey);
        let cipher = crypto.createCipheriv(algorithm, key, iv);
        let encrypted = cipher.update(clearText);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }
    decrypt(text) {
        const self = this;
        text = text + '';
        let textParts = text.split(':');
        let shifted = textParts.shift();
        if (!shifted)
            throw new Error('text.split failed');
        let iv = new Buffer(shifted, 'hex');
        let encryptedText = new Buffer(textParts.join(':'), 'hex');
        let key = new Buffer(self.encryptionKey);
        let decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
}
exports.CaptainEncryptor = CaptainEncryptor;
//# sourceMappingURL=Encryptor.js.map