/**
 * Content of this file is mostly taken from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
 */
const crypto = require('crypto');
const algorithm = 'aes-256-ctr';
const IV_LENGTH = 16; // For AES, this is always 16

class Encryptor {

    constructor(encryptionKey) {
        if (!encryptionKey || encryptionKey.length < 32) {
            throw new Error('Encryption Key too short!');
        }
        encryptionKey = encryptionKey.slice(0, 32);
        this.encryptionKey = encryptionKey + '';
    }

    encrypt(clearText) {

        const self = this;
        clearText = clearText + '';

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
        let iv = new Buffer(textParts.shift(), 'hex');
        let encryptedText = new Buffer(textParts.join(':'), 'hex');
        let key = new Buffer(self.encryptionKey);
        let decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(encryptedText);

        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    }
}


module.exports = {
    create: function (encryptionKey) {
        return new Encryptor(encryptionKey);
    }
};