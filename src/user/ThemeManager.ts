import ApiStatusCodes from '../api/ApiStatusCodes'
import DataStore from '../datastore/DataStore'
import DataStoreProvider from '../datastore/DataStoreProvider'
import CapRoverTheme from '../models/CapRoverTheme'
import CaptainConstants from '../utils/CaptainConstants'
import Logger from '../utils/Logger'
import Utils from '../utils/Utils'
import fs = require('fs-extra')

const builtInThemes = [] as CapRoverTheme[]

/**
 * Parses a string containing themed configuration fields into a JSON object.
 * Each field must start with "###CapRoverTheme." followed by the field name and its content.
 * The function dynamically identifies and extracts these fields, preserving their original formatting.
 * Field names are converted to lowercase to serve as keys in the resulting JSON object,
 * with the corresponding content as the values, maintaining any internal formatting.
 *
 * @param {string} input - Themed configuration string.
 * @return {Object} JSON object with keys representing field names and values containing the respective content.
 *
 * Example:
 * Input:
 *   "###CapRoverTheme.name:
 *   Green Arrow
 *   ###CapRoverTheme.content:
 *   { colorA: '#fff',
 *     colorB: '#fff'
 *  }"
 * Output:
 *   { name: "Green Arrow", content: "{ colorA: '#fff' , colorB: '#fff' }" }
 */

function parseCapRoverTheme(input: string) {
    const result = {} as { [id: string]: string }
    const lines = input.split('\n')
    let currentField = undefined as string | undefined

    lines.forEach((line, index) => {
        if (line.startsWith('###CapRoverTheme.')) {
            // Calculate the start position for the field name and remove the prefix '###CapRoverTheme.'
            const start = line.indexOf('.') + 1
            currentField = line.substring(start, line.length - 1).trim()
            result[currentField] = ''
        } else if (currentField) {
            // Check if we already have content for the current field to add a newline
            if (result[currentField].length > 0) {
                result[currentField] += '\n' + line
            } else {
                result[currentField] += line
            }
        }
    })

    for (const key in result) {
        result[key] = result[key].trim()
    }

    return result
}

function populateBuiltInThemes() {
    const themesDirectory = __dirname + '/../../template/themes'
    const rawContent = [] as string[]

    const files = fs.readdirSync(themesDirectory).map((it) => {
        return {
            fileName: it,
            number: parseInt(it.split('-')[0]),
        }
    })

    files.sort((a, b) => a.number - b.number)

    files
        .map((it) => it.fileName)
        .forEach((file) => {
            const fileContent = fs.readFileSync(
                `${themesDirectory}/${file}`,
                'utf8'
            )
            rawContent.push(fileContent)
        })

    rawContent.forEach((it) => {
        const parsedTheme = {
            ...parseCapRoverTheme(it),
            builtIn: true,
        } as CapRoverTheme
        builtInThemes.push(parsedTheme)
    })
}

populateBuiltInThemes()

export class ThemeManager {
    constructor(private dataStore: DataStore) {}

    getAllThemes() {
        const self = this

        return Promise.resolve() //
            .then(function () {
                return self.dataStore.getThemes()
            })
            .then(function (themes) {
                return [...builtInThemes, ...themes]
            })
    }

    deleteTheme(themeName: string) {
        const self = this
        return Promise.resolve() //
            .then(function () {
                return Promise.all([
                    self.getAllThemes(),
                    self.dataStore.getCurrentThemeName(),
                ])
            })
            .then(function ([themesFetched, currentTheme]) {
                const themes = Utils.copyObject(themesFetched)
                const newThemes = [] as CapRoverTheme[]
                themes.forEach((it) => {
                    if (it.name !== themeName) {
                        newThemes.push(it)
                    } else if (it.builtIn) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.ILLEGAL_PARAMETER,
                            'Cannot delete a built-in theme'
                        )
                    }
                })

                if (themes.length === newThemes.length) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'Theme not found'
                    )
                }

                return Promise.resolve()
                    .then(function () {
                        if (currentTheme && currentTheme === themeName) {
                            return self.dataStore.setCurrentTheme('')
                        }
                    })
                    .then(function () {
                        return self.dataStore.deleteTheme(themeName)
                    })
            })
    }

    updateTheme(oldName: string, theme: CapRoverTheme) {
        const self = this
        return Promise.resolve()
            .then(function () {
                theme.builtIn = false
                return self.getAllThemes()
            })
            .then(function (themesFetched) {
                const themes = Utils.copyObject(themesFetched)
                const idx = themes.findIndex((t) => t.name === oldName)
                if (!oldName) {
                    // new theme

                    if (themes.some((t) => t.name === theme.name)) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.ILLEGAL_PARAMETER,
                            'Wanted to store a new theme, but it already exists with the same name'
                        )
                    }

                    themes.push(theme)
                } else if (idx >= 0) {
                    // replacing existing theme

                    if (themes[idx].builtIn) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.ILLEGAL_PARAMETER,
                            'Cannot edit a built-in theme'
                        )
                    }

                    themes[idx] = theme
                } else {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'Theme not found'
                    )
                }

                return self.dataStore
                    .saveThemes(themes) //
                    .then(() => {
                        return self.dataStore.setCurrentTheme(theme.name)
                    })
            })
    }

    setCurrent(themeName: string) {
        const self = this

        return Promise.resolve()
            .then(function () {
                return self.getAllThemes()
            })
            .then(function (themes) {
                if (!themeName || themes.some((it) => it.name === themeName))
                    return self.dataStore.setCurrentTheme(themeName)

                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'Theme not found'
                )
            })
    }

    getCurrentTheme(): Promise<CapRoverTheme | undefined> {
        const self = this

        return Promise.resolve()
            .then(function () {
                return Promise.all([
                    self.getAllThemes(),
                    self.dataStore.getCurrentThemeName(),
                ])
            })
            .then(function ([themes, themeName]) {
                if (!themeName) return undefined

                const theme = themes.find((it) => it.name === themeName)

                if (!theme) {
                    Logger.e(
                        new Error(
                            'Theme name was provided but could not be found: ' +
                                themeName
                        )
                    )
                }

                return theme
            })
    }
}

export class ThemeManagerPublic {
    private static themeManagerPublic = new ThemeManager(
        DataStoreProvider.getDataStore(CaptainConstants.rootNameSpace)
    )

    getCurrentTheme() {
        return Promise.resolve() //
            .then(function () {
                return ThemeManagerPublic.themeManagerPublic.getCurrentTheme()
            })
    }
}
