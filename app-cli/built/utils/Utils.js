"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    copyObject(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    generateUuidV4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    },
    getAnsiColorRegex() {
        const pattern = [
            '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007)',
            '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
        ].join('|');
        return new RegExp(pattern, 'g');
    },
    cleanUpUrl(urlInput) {
        if (!urlInput || !urlInput.length)
            return null;
        let cleanedUrl = urlInput;
        if (cleanedUrl.indexOf('#') >= 0)
            cleanedUrl = cleanedUrl.substr(0, cleanedUrl.indexOf('#'));
        const hasSlashAtTheEnd = cleanedUrl.substr(cleanedUrl.length - 1, 1) === '/';
        if (hasSlashAtTheEnd) {
            // Remove the slash at the end
            cleanedUrl = cleanedUrl.substr(0, cleanedUrl.length - 1);
        }
        cleanedUrl = cleanedUrl.replace('http://', '').replace('https://', '').trim();
        return cleanedUrl;
    }
};
//# sourceMappingURL=Utils.js.map