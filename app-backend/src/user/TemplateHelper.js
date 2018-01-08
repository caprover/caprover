const request = require('request');
const fs = require('fs-extra');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const Logger = require('../utils/Logger');

function getTagsForImage(imageBaseName, url, allTags) {

    if (!url) {
        url = 'https://hub.docker.com/v2/repositories/' + imageBaseName + '/tags';
    }

    return new Promise(function (resolve, reject) {

        request(url,

            function (error, response, body) {

                if (error || !body) {
                    Logger.e(error);
                    reject(error);
                    return;
                }

                body = JSON.parse(body);

                let results = null;

                if (body) {
                    results = body.results;
                }

                if (!results) {
                    Logger.e('NO RESULT');
                    reject(new Error('NO RESULT'));
                    return;
                }

                if (!allTags) {
                    allTags = [];
                }

                for (let idx = 0; idx < results.length; idx++) {
                    allTags.push(results[idx].name);
                }

                if (body.next) {
                    resolve(getTagsForImage(imageBaseName, body.next, allTags));
                    return;
                }

                resolve(allTags);
            });
    });
}

function firstEndsWithSecond(str1, str2) {
    if (!str1 || !str2) {
        throw new Error('Str1 or Str2 are null ' + !str1 + ' ' + !str2)
    }
    let idx = str1.indexOf(str2);
    return idx >= 0 && (idx + str2.length) === str1.length;
}

function isEmpty(obj) {
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            return false;
        }
    }
    return true;
}

class TemplateHelper {

    constructor() {

        const templates = [
            {
                templateName: 'node',
                dockerHubImageName: 'library/node',
                dockerFileFromName: 'node',
                displayName: 'NodeJS',
                tagSuffix: '-alpine'
            },
            {
                templateName: 'php',
                dockerHubImageName: 'library/php',
                dockerFileFromName: 'php',
                displayName: 'PHP',
                tagSuffix: '-apache'
            },
            {
                templateName: 'python',
                dockerHubImageName: 'library/python',
                dockerFileFromName: 'python',
                displayName: 'Python',
                tagSuffix: '-alpine3.6'
            },
            {
                templateName: 'ruby-rack',
                dockerHubImageName: 'library/ruby',
                dockerFileFromName: 'ruby-rack',
                displayName: 'Ruby Rack',
                tagSuffix: '-alpine3.7'
            }
        ];

        const dockerfilesRoot = __dirname + '/../dockerfiles/';

        for (let i = 0; i < templates.length; i++) {
            templates[i].postFromLines = fs.readFileSync(dockerfilesRoot + templates[i].templateName, 'utf8');
        }

        this.templates = templates;
        this.cachedImageTags = {};

        this.updateCachedImageTags();
    }

    getImageTags(templateName) {

        if (isEmpty(this.cachedImageTags)) {
            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Please wait about 30 seconds, then try again.');
        }

        const self = this;
        for (let i = 0; i < self.templates.length; i++) {
            if (self.templates[i].templateName === templateName) {
                return self.cachedImageTags[self.templates[i].dockerHubImageName];
            }
        }

        throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'TEMPLATE NAME NOT FOUND: ' + templateName);
    }

    updateCachedImageTags() {

        const self = this;
        self.cachedImageTags = {};

        let tempCache = {};
        for (let i = 0; i < self.templates.length; i++) {

            const currentImageName = self.templates[i].dockerHubImageName;

            getTagsForImage(currentImageName)
                .then(function (tags) {

                    tempCache[currentImageName] = tags;

                    let isAllDone = true;

                    for (let j = 0; j < self.templates.length; j++) {
                        let imageName = self.templates[j].dockerHubImageName;
                        if (!tempCache[imageName]) {
                            isAllDone = false;
                        }
                    }

                    if (isAllDone) {

                        Logger.d('Template Cache Updated!');

                        self.cachedImageTags = tempCache;

                        // Used for README
                        for (let tempIdx = 0; tempIdx < self.templates.length; tempIdx++) {
                            Logger.d(' ');
                            Logger.d(self.templates[tempIdx].templateName + '/');
                            Logger.d(self.getDockerVersionsForTemplateName(self.templates[tempIdx].templateName).join(', '));
                            Logger.d(' ');
                        }

                        setTimeout(function () {

                            self.updateCachedImageTags();

                        }, 24 * 60 * 60 * 1000); // refresh cache everyday
                    }

                })
                .catch(function (error) {

                    Logger.e(error);

                    setTimeout(function () {

                        self.updateCachedImageTags();

                    }, 2000);

                });
        }
    }

    getDockerVersionsForTemplateName(templateName) {

        const self = this;

        let templateObj = self.getTemplateFromTemplateName(templateName);

        let tags = self.getImageTags(templateObj.templateName);

        let dockerVersions = [];
        for (let i = 0; i < tags.length; i++) {
            let t = tags[i];
            if (firstEndsWithSecond(t, templateObj.tagSuffix)) {
                dockerVersions.push(t.substring(0, t.length - templateObj.tagSuffix.length));
            }
        }

        return dockerVersions;
    }

    getTemplateFromTemplateName(templateName) {
        for (let i = 0; i < this.templates.length; i++) {
            if (this.templates[i].templateName === templateName) {
                return this.templates[i];
            }
        }
        throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'TEMPLATE NAME NOT FOUND: ' + templateName);
    }

    getBaseDockerFile(templateName, templateVersion) {

        const self = this;

        let dockerVersions = self.getDockerVersionsForTemplateName(templateName);
        let templateObj = self.getTemplateFromTemplateName(templateName);

        for (let i = 0; i < dockerVersions.length; i++) {
            if (dockerVersions[i] === templateVersion) {
                return templateObj.dockerHubImageName + ':' +
                    templateVersion + templateObj.tagSuffix;
            }
        }

        throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC,
            'Template version is not valid! ' + templateVersion);
    }

    getDockerfileContentFromTemplateTag(templateAndVersion) {
        const self = this;
        let templateName = templateAndVersion.split('/')[0];
        let templateVersion = templateAndVersion.split('/')[1];
        if (!templateVersion) {
            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Template version field is empty!');
        }

        const fromLine = self.getBaseDockerFile(templateName, templateVersion);

        return 'FROM ' + fromLine + '\n' + self.getTemplateFromTemplateName(templateName).postFromLines;
    }
}

const templateHelperInstance = new TemplateHelper();

module.exports = {
    get: function () {
        return templateHelperInstance;
    }
};
