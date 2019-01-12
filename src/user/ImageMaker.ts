/*
                              +---------------------------------+
+------------------+          |                                 |
|------------------|          |      Assign the final Image     |                +--------------------+
||                ||          |        (library/mysql           +----------------+   Retag and push   +<-----------+
||    Update      |-----------+             or                  |                |     IF NEEDED      |            |
||Captain Service ||          |  repo.com:996/captain/myimage)  |                +--------------------+            |
||                ||          |                                 |                                                  |
|------------------|          |     as new ver's image          +-----------+                                      +
+------------------+          |                                 |           |                                    CREATE
                              +---------------------------------+           |                             img-captain--appname:5
                              |                                 |           |
                              |    Set the Deployed Version     |           +-------------+                         ^
                              +---------------------------------+                         |                         |
                                                                                          |                         |
                                                                                          |                         |
                                                                                          |                         |
                                                          +-----------------------+       |                         |
                                                          |                       |       |                         |
                                                          |      Docker ImageName +-------+                         |
                                                          |                       |                                 |
                                                          +-----------------------+                                 |
       +-------------------+                              |                       |                                 |
       |                   |                              |    captain-definition +-------------+                   |
       |                   |                              |         content       |             |                   |
       |   ServiceManager  +----> CreateNewVersion +----> +-----------------------+             |                   |
       |                   |                              |                       |             ^                   |
       |                   |                              |         Uploaded Tar  +-----------------> ImageMaker.   +
       +-------------------+                              |                       |             ^       createImage(appName,Ver,Data)
                                                          +-----------------------+             |
                                                          |                       |             |
                                                          |             GIT Repo  +-------------+
                                                          |                       |
                                                          +-----------------------+

*/

import DockerApi from '../docker/DockerApi'
import CaptainConstants = require('../utils/CaptainConstants')
import fs = require('fs-extra')
import tar = require('tar')
import path = require('path')
import TemplateHelper = require('./TemplateHelper')
import GitHelper = require('../utils/GitHelper')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import { AnyError } from '../models/OtherTypes'
import BuildLog = require('./BuildLog')
import DataStore = require('../datastore/DataStore')
import DockerRegistryHelper = require('./DockerRegistryHelper')
import { IBuiltImage } from '../models/IBuiltImage'

const RAW_SOURCE_DIRECTORY = 'source_files'
const TAR_FILE_NAME_READY_FOR_DOCKER = 'image.tar'
const CAPTAIN_DEFINITION_FILE = 'captain-definition'
const DOCKER_FILE = 'Dockerfile'

export default class ImageMaker {
    constructor(
        private dockerRegistryHelper: DockerRegistryHelper,
        private dockerApi: DockerApi,
        private datastore: DataStore,
        private buildLogs: IHashMapGeneric<BuildLog>,
        private activeBuilds: IHashMapGeneric<boolean>
    ) {
        //
    }

    private getDirectoryForRawSource(appName: string, version: number) {
        return (
            CaptainConstants.captainRawSourceDirectoryBase +
            '/' +
            appName +
            '/' +
            version
        )
    }

    /**
     * Creates image if necessary, or just simply passes the image name
     */
    ensureImage(
        imageSource: IImageSource,
        appName: string,
        appVersion: number
    ): Promise<IBuiltImage> {
        const self = this

        this.activeBuilds[appName] = true
        this.buildLogs[appName] =
            this.buildLogs[appName] ||
            new BuildLog(CaptainConstants.configs.buildLogSize)

        this.buildLogs[appName].clear()
        this.buildLogs[appName].log('------------------------- ' + new Date())
        this.buildLogs[appName].log('Build started for ' + appName)

        let gitHash = ''

        const baseDir = self.getDirectoryForRawSource(appName, appVersion)
        const rawDir = baseDir + '/' + RAW_SOURCE_DIRECTORY
        const tarFilePath = baseDir + '/' + TAR_FILE_NAME_READY_FOR_DOCKER

        const baseImageNameWithoutVerAndReg = self.datastore.getBuiltImageNameBase(
            appName
        ) // img-captain--myapp
        let fullImageName = '' // repo.domain.com:998/username/reponame:8

        return Promise.resolve() //
            .then(function() {
                return self.ensureDirectoryWithCaptainDefinition(
                    imageSource,
                    rawDir
                )
            })
            .then(function(gitHashFromImageSource) {
                gitHash = gitHashFromImageSource
                // some users convert the directory into TAR instead of converting the content into TAR.
                // we go one level deep and try to find the right directory.
                return self.correctDirectoryAndEnsureCaptainDefinition(rawDir)
            })
            .then(function(correctedDir) {
                return self
                    .getCaptainDefinition(correctedDir)
                    .then(function(captainDefinition) {
                        if (captainDefinition.imageName) {
                            self.buildLogs[appName].log(
                                `An explicit image name was provided (${
                                    captainDefinition.imageName
                                }). Therefore, no build process is needed.`
                            )
                            self.buildLogs[appName].log(
                                `The app (${appName}) will be re-deployed with this image: ${
                                    captainDefinition.imageName
                                }`
                            )
                            return captainDefinition.imageName + ''
                        }

                        return self.getBuildPushAndReturnImageName(
                            captainDefinition,
                            correctedDir,
                            tarFilePath,
                            baseImageNameWithoutVerAndReg,
                            appName,
                            appVersion
                        )
                    })
            })
            .then(function(ret) {
                fullImageName = ret
            })
            .then(function() {
                return fs.remove(baseDir)
            })
            .then(function() {
                if (imageSource.uploadedTarPathSource) {
                    return fs.remove(
                        imageSource.uploadedTarPathSource.uploadedTarPath
                    )
                }
            })
            .catch(function(err) {
                return fs
                    .remove(baseDir)
                    .then(function() {
                        throw new Error('ensure catch')
                    })
                    .catch(function() {
                        return Promise.reject(err)
                    })
            })
            .catch(function(err) {
                if (imageSource.uploadedTarPathSource) {
                    return fs
                        .remove(
                            imageSource.uploadedTarPathSource.uploadedTarPath
                        )
                        .then(function() {
                            throw new Error('ensure catch')
                        })
                        .catch(function() {
                            return Promise.reject(err)
                        })
                }
                return Promise.reject(err)
            })
            .then(function() {
                self.activeBuilds[appName] = false
                return {
                    imageName: fullImageName,
                    gitHash: gitHash,
                }
            })
            .catch(function(error) {
                self.activeBuilds[appName] = false
                return Promise.reject(error)
            })
    }

    private getBuildPushAndReturnImageName(
        captainDefinition: ICaptainDefinition,
        correctedDirProvided: string,
        tarFilePath: string,
        baseImageNameWithoutVersionAndReg: string,
        appName: string,
        appVersion: number
    ) {
        const self = this
        return Promise.resolve() //
            .then(function() {
                return self
                    .convertCaptainDefinitionToDockerfile(
                        captainDefinition,
                        correctedDirProvided
                    )
                    .then(function() {
                        return self.convertContentOfDirectoryIntoTar(
                            correctedDirProvided,
                            tarFilePath
                        )
                    })
                    .then(function() {
                        return self.dockerApi
                            .buildImageFromDockerFile(
                                baseImageNameWithoutVersionAndReg,
                                appVersion,
                                tarFilePath,
                                self.buildLogs[appName]
                            )
                            .catch(function(error: AnyError) {
                                throw ApiStatusCodes.createError(
                                    ApiStatusCodes.BUILD_ERROR,
                                    ('' + error).trim()
                                )
                            })
                    })
                    .then(function() {
                        return self.dockerRegistryHelper.retagAndPushIfDefaultPushExist(
                            baseImageNameWithoutVersionAndReg,
                            appVersion,
                            self.buildLogs[appName]
                        )
                    })
            })
    }

    /**
     * Returns a promise that resolve to path a directory where source files + captain definition
     *
     * @param source        the image source
     * @param destDirectory the path to directory where we want to have all our contents
     */
    private ensureDirectoryWithCaptainDefinition(
        source: IImageSource,
        destDirectory: string
    ) {
        return Promise.resolve() //
            .then(function() {
                return fs.ensureDir(destDirectory)
            })
            .then(function() {
                // If uploadedTarPath then extract into a directory
                //
                // If Repo then download.
                //
                // If captainDefinitionContent then create a directory and output to a directory
                //
                // Else THROW ERROR

                const srcTar = source.uploadedTarPathSource
                if (srcTar) {
                    // extract file to to destDirectory
                    return tar
                        .extract({
                            file: srcTar.uploadedTarPath,
                            cwd: destDirectory,
                        })
                        .then(function() {
                            return srcTar.gitHash
                        })
                }

                const srcRepo = source.repoInfoSource
                if (srcRepo) {
                    return GitHelper.clone(
                        srcRepo.user,
                        srcRepo.password,
                        srcRepo.repo,
                        srcRepo.branch,
                        destDirectory
                    ).then(function() {
                        return GitHelper.getLastHash(destDirectory)
                    })
                }

                const captainDefinitionContentSource =
                    source.captainDefinitionContentSource
                if (captainDefinitionContentSource) {
                    return fs
                        .outputFile(
                            destDirectory + '/' + CAPTAIN_DEFINITION_FILE,
                            captainDefinitionContentSource.captainDefinitionContent
                        )
                        .then(function() {
                            return captainDefinitionContentSource.gitHash
                        })
                }
                // we should never get here!
                throw new Error('Source is unknown!')
            })
    }

    private getAllChildrenOfDirectory(directory: string) {
        return Promise.resolve() //
            .then(function() {
                return new Promise<string[]>(function(resolve, reject) {
                    fs.readdir(directory, function(err, files) {
                        if (err) {
                            reject(err)
                            return
                        }
                        resolve(files)
                    })
                })
            })
    }

    private getCaptainDefinition(directoryWithCaptainDefinition: string) {
        return Promise.resolve() //
            .then(function() {
                return fs.readJson(
                    directoryWithCaptainDefinition +
                        '/' +
                        CAPTAIN_DEFINITION_FILE
                )
            })
            .then(function(data: ICaptainDefinition) {
                if (!data) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        'Captain Definition File is empty!'
                    )
                }

                if (!data.schemaVersion) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        'Captain Definition version is empty!'
                    )
                }

                if (data.schemaVersion !== 2) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        'Captain Definition version is not supported! Read migration guides to schemaVersion 2'
                    )
                }

                const hasDockerfileLines =
                    data.dockerfileLines && data.dockerfileLines.length > 0

                let numberOfProperties =
                    (!!data.templateId ? 1 : 0) +
                    (!!data.imageName ? 1 : 0) +
                    (!!data.dockerfilePath ? 1 : 0) +
                    (hasDockerfileLines ? 1 : 0)

                if (numberOfProperties !== 1) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        'One, and only one, of these properties should be present in captain-definition: templateId, imageName, dockerfilePath, or, dockerfileLines'
                    )
                }

                return data
            })
    }

    private convertCaptainDefinitionToDockerfile(
        captainDefinition: ICaptainDefinition,
        directoryWithCaptainDefinition: string
    ) {
        const self = this
        return Promise.resolve() //
            .then(function() {
                let data = captainDefinition
                if (data.templateId) {
                    return TemplateHelper.get().getDockerfileContentFromTemplateTag(
                        data.templateId
                    )
                } else if (data.dockerfileLines) {
                    return data.dockerfileLines.join('\n')
                } else if (data.dockerfilePath) {
                    if (data.dockerfilePath.startsWith('..')) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                            'dockerfilePath should not refer to parent directory!'
                        )
                    }

                    return fs
                        .readFileSync(
                            path.join(
                                directoryWithCaptainDefinition,
                                data.dockerfilePath
                            )
                        )
                        .toString()
                } else if (data.imageName) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        'ImageName cannot be rebuilt'
                    )
                } else {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        'dockerfileLines, dockerFilePath, templateId or imageName must be present. Both should not be present at the same time'
                    )
                }
            })
            .then(function(dockerfileContent) {
                return fs.outputFile(
                    directoryWithCaptainDefinition + '/' + DOCKER_FILE,
                    dockerfileContent
                )
            })
    }

    private correctDirectoryAndEnsureCaptainDefinition(
        originalDirectory: string
    ) {
        const self = this

        function isCaptainDefinitionInDir(dir: string) {
            const pathToCheck = path.join(dir, CAPTAIN_DEFINITION_FILE)
            return Promise.resolve()
                .then(function() {
                    return fs.pathExists(pathToCheck)
                })
                .then(function(exits) {
                    return !!exits && fs.statSync(pathToCheck).isFile()
                })
        }

        return Promise.resolve()
            .then(function() {
                // make sure if you need to go to child directory
                return isCaptainDefinitionInDir(originalDirectory)
            })
            .then(function(exists) {
                if (exists) return originalDirectory

                // check if there is only one child
                // check if it's a directory
                // check if captain definition exists in it
                // if so, return the child directory
                return self
                    .getAllChildrenOfDirectory(originalDirectory)
                    .then(function(files) {
                        files = files || []
                        if (files.length === 1) {
                            return isCaptainDefinitionInDir(
                                path.join(originalDirectory, files[0])
                            ) //
                                .then(function(existsInChild) {
                                    if (existsInChild)
                                        return path.join(
                                            originalDirectory,
                                            files[0]
                                        )

                                    throw ApiStatusCodes.createError(
                                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                                        'Captain Definition file does not exist!'
                                    )
                                })
                        }

                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                            'Captain Definition file does not exist!'
                        )
                    })
            })
    }

    private convertContentOfDirectoryIntoTar(
        sourceDirectory: string,
        tarFilePath: string
    ) {
        return Promise.resolve() //
            .then(function() {
                return tar.c(
                    {
                        file: tarFilePath,
                        cwd: sourceDirectory,
                    },
                    ['./']
                )
            })
    }
}
