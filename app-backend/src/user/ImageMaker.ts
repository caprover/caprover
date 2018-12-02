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

import DockerApi = require('../docker/DockerApi')
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

const RAW_SOURCE_DIRECTORY = 'source_files'
const TAR_FILE_NAME_READY_FOR_DOCKER = 'image.tar'
const CAPTAIN_DEFINITION_FILE = 'captain-definition'
const DOCKER_FILE = 'Dockerfile'

class ImageMaker {
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
    ensureImage(source: IImageSource, appName: string, appVersion: number) {
        if (source.sourceImageName) {
            return Promise.resolve(source.sourceImageName)
        }

        const self = this

        this.activeBuilds[appName] = true
        this.buildLogs[appName] =
            this.buildLogs[appName] ||
            new BuildLog(CaptainConstants.buildLogSize)

        this.buildLogs[appName].clear()
        this.buildLogs[appName].log('------------------------- ' + new Date())
        this.buildLogs[appName].log('Build started for ' + appName)

        const baseDir = self.getDirectoryForRawSource(appName, appVersion)
        const rawDir = baseDir + '/' + RAW_SOURCE_DIRECTORY
        const tarFilePath = baseDir + '/' + TAR_FILE_NAME_READY_FOR_DOCKER

        const baseImageNameWithoutVersionAndReg = self.datastore.getImageNameBase(
            appName
        ) // img-captain--myapp
        let fullImageName = '' // repo.domain.com:998/username/reponame:8

        return Promise.resolve() //
            .then(function() {
                return self.ensureDirectoryWithCaptainDefinition(source, rawDir)
            })
            .then(function() {
                // some users convert the directory into TAR instead of converting the content into TAR.
                // we go one level deep and try to find the right directory.
                return self.correctDirectoryAndEnsureCaptainDefinition(rawDir)
            })
            .then(function(correctedDir) {
                return self.convertCaptainDefinitionToDockerfile(correctedDir)
            })
            .then(function(correctedDir) {
                return self.convertContentOfDirectoryIntoTar(
                    correctedDir,
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
            .then(function(ret) {
                fullImageName = ret
            })
            .then(function() {
                return fs.remove(baseDir)
            })
            .then(function() {
                if (source.uploadedTarPath) {
                    return fs.remove(source.uploadedTarPath)
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
                if (source.uploadedTarPath) {
                    return fs
                        .remove(source.uploadedTarPath)
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
                return fullImageName
            })
            .catch(function(error) {
                self.activeBuilds[appName] = false
                return new Promise<string>(function(resolve, reject) {
                    reject(error)
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

                if (source.uploadedTarPath) {
                    // extract file to to destDirectory
                    return tar
                        .extract({
                            file: source.uploadedTarPath,
                            cwd: destDirectory,
                        })
                        .then(function() {
                            //just to convert to return Promise<void>
                        })
                }

                if (source.repoInfo) {
                    const repoInfo = source.repoInfo
                    return GitHelper.clone(
                        repoInfo.user,
                        repoInfo.password,
                        repoInfo.repo,
                        repoInfo.branch,
                        destDirectory
                    ).then(function() {
                        //just to convert to return Promise<void>
                    })
                    // TODO?? Where should we get the hash :/ It doesn't seem to belong to ImageMaker
                    // .then(function() {
                    //     return GitHelper.getLastHash(destDirectory)
                    // })
                }

                if (source.captainDefinitionContent) {
                    return fs
                        .outputFile(
                            destDirectory + '/' + CAPTAIN_DEFINITION_FILE,
                            source.captainDefinitionContent
                        )
                        .then(function() {
                            //just to convert to return Promise<void>
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

    private convertCaptainDefinitionToDockerfile(
        directoryWithCaptainDefinition: string
    ) {
        return Promise.resolve() //
            .then(function() {
                return fs.readJson(
                    directoryWithCaptainDefinition +
                        '/' +
                        CAPTAIN_DEFINITION_FILE
                )
            })
            .then(function(data) {
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

                if (data.schemaVersion === 1) {
                    const templateIdTag = data.templateId
                    const dockerfileLines: string[] = data.dockerfileLines
                    const hasDockerfileLines =
                        dockerfileLines && dockerfileLines.length > 0

                    if (hasDockerfileLines && !templateIdTag) {
                        return dockerfileLines.join('\n')
                    } else if (!hasDockerfileLines && templateIdTag) {
                        return TemplateHelper.get().getDockerfileContentFromTemplateTag(
                            templateIdTag
                        )
                    } else {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                            'Dockerfile or TemplateId must be present. Both should not be present at the same time'
                        )
                    }
                }

                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    'Captain Definition version is not supported!'
                )
            })
            .then(function(dockerfileContent) {
                return fs.outputFile(
                    directoryWithCaptainDefinition + '/' + DOCKER_FILE,
                    dockerfileContent
                )
            })
            .then(function() {
                return directoryWithCaptainDefinition
            })
    }

    private correctDirectoryAndEnsureCaptainDefinition(
        originalDirectory: string
    ) {
        const self = this
        return Promise.resolve()
            .then(function() {
                // make sure if you need to go to child directory
                return fs.pathExists(
                    originalDirectory + '/' + CAPTAIN_DEFINITION_FILE
                )
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
                        if (
                            files.length !== 1 ||
                            !fs
                                .statSync(
                                    path.join(originalDirectory, files[0])
                                )
                                .isDirectory()
                        ) {
                            throw ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_ERROR_GENERIC,
                                'Captain Definition file does not exist!'
                            )
                        }

                        return path.join(originalDirectory, files[0])
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

export = ImageMaker
