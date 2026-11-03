import ApiStatusCodes from '../api/ApiStatusCodes'
import { IHashMapGeneric } from '../models/ICacheGeneric'
import { ITemplate } from '../models/OtherTypes'
import { getText } from './HttpUtils'
import Logger from './Logger'

function getTagsForImage(
    imageBaseName: string,
    url: string | undefined,
    allTags: string[] | undefined
): Promise<string[]> {
    if (!url) {
        url = `https://hub.docker.com/v2/repositories/${imageBaseName}/tags`
    }

    return new Promise<string[]>(function (resolve, reject) {
        getText(url!)
            .then(function (body) {
                if (!body) {
                    reject(new Error('Received empty response from Docker Hub'))
                    return
                }

                let parsedBody: any
                try {
                    // Sometimes Docker server is down and it crashes Captain!
                    parsedBody = JSON.parse(body)
                } catch (e) {
                    Logger.e(e)
                }

                let results: any

                if (parsedBody) {
                    results = parsedBody.results
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

                if (parsedBody.next) {
                    resolve(
                        getTagsForImage(imageBaseName, parsedBody.next, allTags)
                    )
                    return
                }

                resolve(allTags)
            })
            .catch(function (error) {
                Logger.e(error)
                reject(error)
            })
    })
}

function firstEndsWithSecond(str1: string, str2: string) {
    if (!str1 || !str2) {
        throw new Error(`Str1 or Str2 are null ${!str1} ${!str2}`)
    }
    const idx = str1.indexOf(str2)
    return idx >= 0 && idx + str2.length === str1.length
}

function isEmpty(obj: any) {
    for (const key in obj) {
        // eslint-disable-next-line no-prototype-builtins
        if (obj.hasOwnProperty(key)) {
            return false
        }
    }
    return true
}

type AnyHashMap = IHashMapGeneric<any>

class TemplateHelperVersionPrinter {
    private cachedImageTags: AnyHashMap

    constructor() {
        this.cachedImageTags = {}
    }

    getDockerVersionsForTemplateName(templateObj: ITemplate) {
        const self = this

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

    printAvailableImageTagsForReadme(templates: ITemplate[]) {
        const self = this
        self.cachedImageTags = {}

        const tempCache: AnyHashMap = {}
        for (let i = 0; i < templates.length; i++) {
            const currentImageName = templates[i].dockerHubImageName

            getTagsForImage(currentImageName, undefined, undefined)
                .then(function (tags) {
                    tempCache[currentImageName] = tags

                    let isAllDone = true

                    for (let j = 0; j < templates.length; j++) {
                        const imageName = templates[j].dockerHubImageName
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
                            tempIdx < templates.length;
                            tempIdx++
                        ) {
                            Logger.d(' ')
                            Logger.d(templates[tempIdx].templateName + '/')
                            Logger.d(
                                self
                                    .getDockerVersionsForTemplateName(
                                        templates[tempIdx]
                                    )
                                    .join(', ')
                            )
                            Logger.d(' ')
                        }
                    }
                })
                .catch(function (error) {
                    Logger.e(error)
                })
        }
    }
}

export default TemplateHelperVersionPrinter
