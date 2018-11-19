var request = require('request');
var fs = require('fs-extra');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var Logger = require('../utils/Logger');
var CaptainConstants = require('../utils/CaptainConstants');
function getTagsForImage(imageBaseName, url, allTags) {
    if (!url) {
        url = 'https://hub.docker.com/v2/repositories/' + imageBaseName + '/tags';
    }
    return new Promise(function (resolve, reject) {
        request(url, function (error, response, body) {
            if (error || !body) {
                Logger.e(error);
                reject(error);
                return;
            }
            try {
                // Sometimes Docker server is down and it crashes Captain!
                body = JSON.parse(body);
            }
            catch (e) {
                Logger.e(e);
            }
            var results = null;
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
            for (var idx = 0; idx < results.length; idx++) {
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
        throw new Error('Str1 or Str2 are null ' + !str1 + ' ' + !str2);
    }
    var idx = str1.indexOf(str2);
    return idx >= 0 && (idx + str2.length) === str1.length;
}
function isEmpty(obj) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            return false;
        }
    }
    return true;
}
var TemplateHelper = /** @class */ (function () {
    function TemplateHelper() {
        var templates = [
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
                templateName: 'python-django',
                dockerHubImageName: 'library/python',
                dockerFileFromName: 'python-django',
                displayName: 'Python Django',
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
        var dockerfilesRoot = __dirname + '/../dockerfiles/';
        for (var i = 0; i < templates.length; i++) {
            templates[i].postFromLines = fs.readFileSync(dockerfilesRoot + templates[i].templateName, 'utf8');
        }
        this.templates = templates;
        this.cachedImageTags = {};
        if (CaptainConstants.isDebug) {
            this.printAvailableImageTagsForReadme();
        }
    }
    TemplateHelper.prototype.getDockerVersionsForTemplateName = function (templateName) {
        var self = this;
        var templateObj = self.getTemplateFromTemplateName(templateName);
        if (isEmpty(this.cachedImageTags)) {
            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Please wait about 30 seconds, then try again.');
        }
        var tags = self.cachedImageTags[templateObj.dockerHubImageName];
        var dockerVersions = [];
        for (var i = 0; i < tags.length; i++) {
            var t = tags[i];
            if (firstEndsWithSecond(t, templateObj.tagSuffix)) {
                dockerVersions.push(t.substring(0, t.length - templateObj.tagSuffix.length));
            }
        }
        return dockerVersions;
    };
    TemplateHelper.prototype.printAvailableImageTagsForReadme = function () {
        var self = this;
        self.cachedImageTags = {};
        var tempCache = {};
        var _loop_1 = function (i) {
            var currentImageName = self.templates[i].dockerHubImageName;
            getTagsForImage(currentImageName)
                .then(function (tags) {
                tempCache[currentImageName] = tags;
                var isAllDone = true;
                for (var j = 0; j < self.templates.length; j++) {
                    var imageName = self.templates[j].dockerHubImageName;
                    if (!tempCache[imageName]) {
                        isAllDone = false;
                    }
                }
                if (isAllDone) {
                    Logger.d('Template Cache Updated!');
                    self.cachedImageTags = tempCache;
                    // Used for README
                    for (var tempIdx = 0; tempIdx < self.templates.length; tempIdx++) {
                        Logger.d(' ');
                        Logger.d(self.templates[tempIdx].templateName + '/');
                        Logger.d(self.getDockerVersionsForTemplateName(self.templates[tempIdx].templateName).join(', '));
                        Logger.d(' ');
                    }
                }
            })
                .catch(function (error) {
                Logger.e(error);
            });
        };
        for (var i = 0; i < self.templates.length; i++) {
            _loop_1(i);
        }
    };
    TemplateHelper.prototype.getTemplateFromTemplateName = function (templateName) {
        for (var i = 0; i < this.templates.length; i++) {
            if (this.templates[i].templateName === templateName) {
                return this.templates[i];
            }
        }
        throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'TEMPLATE NAME NOT FOUND: ' + templateName);
    };
    TemplateHelper.prototype.getDockerfileContentFromTemplateTag = function (templateAndVersion) {
        var self = this;
        var templateName = templateAndVersion.split('/')[0];
        var templateVersion = templateAndVersion.split('/')[1];
        if (!templateVersion) {
            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Template version field is empty!');
        }
        var templateObj = self.getTemplateFromTemplateName(templateName);
        var fromLine = templateObj.dockerHubImageName + ':' + templateVersion + templateObj.tagSuffix;
        return 'FROM ' + fromLine + '\n' + templateObj.postFromLines;
    };
    return TemplateHelper;
}());
var templateHelperInstance = new TemplateHelper();
module.exports = {
    get: function () {
        return templateHelperInstance;
    }
};
