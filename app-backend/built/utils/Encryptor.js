/**
 * Content of this file is mostly taken from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
 */
var crypto = require('crypto');
var algorithm = 'aes-256-ctr';
var IV_LENGTH = 16; // For AES, this is always 16
var Encryptor = /** @class */ (function () {
    function Encryptor(encryptionKey) {
        if (!encryptionKey || encryptionKey.length < 32) {
            throw new Error('Encryption Key too short!');
        }
        encryptionKey = encryptionKey.slice(0, 32);
        this.encryptionKey = encryptionKey + '';
    }
    Encryptor.prototype.encrypt = function (clearText) {
        var self = this;
        clearText = clearText + '';
        var iv = crypto.randomBytes(IV_LENGTH);
        var key = new Buffer(self.encryptionKey);
        var cipher = crypto.createCipheriv(algorithm, key, iv);
        var encrypted = cipher.update(clearText);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    };
    Encryptor.prototype.decrypt = function (text) {
        var self = this;
        text = text + '';
        var textParts = text.split(':');
        var iv = new Buffer(textParts.shift(), 'hex');
        var encryptedText = new Buffer(textParts.join(':'), 'hex');
        var key = new Buffer(self.encryptionKey);
        var decipher = crypto.createDecipheriv(algorithm, key, iv);
        var decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    };
    return Encryptor;
}());
module.exports = {
    create: function (encryptionKey) {
        return new Encryptor(encryptionKey);
    }
};
