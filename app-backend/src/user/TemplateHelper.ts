import request = require('request')
import fs = require('fs-extra')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import Logger = require('../utils/Logger')
import CaptainConstants = require('../utils/CaptainConstants')

function getTagsForImage(
    imageBaseName: string,
    url: string | undefined,
    allTags: string[] | undefined
): Promise<string[]> {
    if (!url) {
        url =
            'https://hub.docker.com/v2/repositories/' + imageBaseName + '/tags'
    }

    return new Promise<string[]>(function(resolve, reject) {
        request(
            url!,

            function(error, response, body) {
                if (error || !body) {
                    Logger.e(error)
                    reject(error)
                    return
                }

                try {
                    // Sometimes Docker server is down and it crashes Captain!
                    body = JSON.parse(body)
                } catch (e) {
                    Logger.e(e)
                }

                let results: any

                if (body) {
                    results = body.results
                }

                if (!results) {
                    Logger.e('NO RESULT')
                    reject(new Error('NO RESULT'))
                    return
                }

                if (!allTags) {
                    allTags = []
                }

                for (let idx = 0; idx < results.length; idx++) {
                    allTags.push(results[idx].name)
                }

                if (body.next) {
                    resolve(getTagsForImage(imageBaseName, body.next, allTags))
                    return
                }

                resolve(allTags)
            }
        )
    })
}

function firstEndsWithSecond(str1: string, str2: string) {
    if (!str1 || !str2) {
        throw new Error('Str1 or Str2 are null ' + !str1 + ' ' + !str2)
    }
    const idx = str1.indexOf(str2)
    return idx >= 0 && idx + str2.length === str1.length
}

function isEmpty(obj: any) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            return false
        }
    }
    return true
}

interface ITemplate {
    templateName: string
    dockerHubImageName: string
    dockerFileFromName: string
    displayName: string
    tagSuffix: string
    postFromLines?: string
}

interface ICache {
    [id: string]: any[]
}

class TemplateHelper {
    private templates: ITemplate[]
    private cachedImageTags: ICache

    constructor() {
        const templates: ITemplate[] = [
            {
                templateName: 'node',
                dockerHubImageName: 'library/node',
                dockerFileFromName: 'node',
                displayName: 'NodeJS',
                tagSuffix: '-alpine',
            },
            {
                templateName: 'php',
                dockerHubImageName: 'library/php',
                dockerFileFromName: 'php',
                displayName: 'PHP',
                tagSuffix: '-apache',
            },
            {
                templateName: 'python-django',
                dockerHubImageName: 'library/python',
                dockerFileFromName: 'python-django',
                displayName: 'Python Django',
                tagSuffix: '-alpine3.6',
            },
            {
                templateName: 'ruby-rack',
                dockerHubImageName: 'library/ruby',
                dockerFileFromName: 'ruby-rack',
                displayName: 'Ruby Rack',
                tagSuffix: '-alpine3.7',
            },
        ]

        const dockerfilesRoot = __dirname + '/../../dockerfiles/'

        for (let i = 0; i < templates.length; i++) {
            templates[i].postFromLines = fs.readFileSync(
                dockerfilesRoot + templates[i].templateName,
                'utf8'
            )
        }

        this.templates = templates
        this.cachedImageTags = {}

        if (CaptainConstants.isDebug) {
            this.printAvailableImageTagsForReadme()
        }
    }

    getDockerVersionsForTemplateName(templateName: string) {
        const self = this

        const templateObj = self.getTemplateFromTemplateName(templateName)

        if (isEmpty(this.cachedImageTags)) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Please wait about 30 seconds, then try again.'
            )
        }

        const tags = self.cachedImageTags[templateObj.dockerHubImageName]

        const dockerVersions = []
        for (let i = 0; i < tags.length; i++) {
            const t = tags[i]
            if (firstEndsWithSecond(t, templateObj.tagSuffix)) {
                dockerVersions.push(
                    t.substring(0, t.length - templateObj.tagSuffix.length)
                )
            }
        }

        return dockerVersions
    }

    printAvailableImageTagsForReadme() {
        const self = this
        self.cachedImageTags = {}

        const tempCache: ICache = {}
        for (let i = 0; i < self.templates.length; i++) {
            const currentImageName = self.templates[i].dockerHubImageName

            getTagsForImage(currentImageName, undefined, undefined)
                .then(function(tags) {
                    tempCache[currentImageName] = tags

                    let isAllDone = true

                    for (let j = 0; j < self.templates.length; j++) {
                        const imageName = self.templates[j].dockerHubImageName
                        if (!tempCache[imageName]) {
                            isAllDone = false
                        }
                    }

                    if (isAllDone) {
                        Logger.d('Template Cache Updated!')

                        self.cachedImageTags = tempCache

                        // Used for README
                        for (
                            let tempIdx = 0;
                            tempIdx < self.templates.length;
                            tempIdx++
                        ) {
                            Logger.d(' ')
                            Logger.d(self.templates[tempIdx].templateName + '/')
                            Logger.d(
                                self
                                    .getDockerVersionsForTemplateName(
                                        self.templates[tempIdx].templateName
                                    )
                                    .join(', ')
                            )
                            Logger.d(' ')
                        }
                    }
                })
                .catch(function(error) {
                    Logger.e(error)
                })
        }
    }

    getTemplateFromTemplateName(templateName: string) {
        for (let i = 0; i < this.templates.length; i++) {
            if (this.templates[i].templateName === templateName) {
                return this.templates[i]
            }
        }
        throw ApiStatusCodes.createError(
            ApiStatusCodes.STATUS_ERROR_GENERIC,
            'TEMPLATE NAME NOT FOUND: ' + templateName
        )
    }

    getDockerfileContentFromTemplateTag(templateAndVersion: string) {
        const self = this
        const templateName = templateAndVersion.split('/')[0]
        const templateVersion = templateAndVersion.split('/')[1]
        if (!templateVersion) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Template version field is empty!'
            )
        }

        const templateObj = self.getTemplateFromTemplateName(templateName)

        const fromLine =
            templateObj.dockerHubImageName +
            ':' +
            templateVersion +
            templateObj.tagSuffix

        return 'FROM ' + fromLine + '\n' + templateObj.postFromLines
    }
}

const templateHelperInstance = new TemplateHelper()

export = {
    get: function() {
        return templateHelperInstance
    },
}
