"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const CaptainConstants = require("../utils/CaptainConstants");
const fs = require("fs-extra");
const tar = require("tar");
const path = require("path");
const TemplateHelper = require("./TemplateHelper");
const GitHelper = require("../utils/GitHelper");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const BuildLog = require("./BuildLog");
const RAW_SOURCE_DIRECTORY = 'source_files';
const TAR_FILE_NAME_READY_FOR_DOCKER = 'image.tar';
const CAPTAIN_DEFINITION_FILE = 'captain-definition';
const DOCKER_FILE = 'Dockerfile';
class ImageMaker {
    constructor(dockerRegistryHelper, dockerApi, datastore, buildLogs, activeBuilds) {
        this.dockerRegistryHelper = dockerRegistryHelper;
        this.dockerApi = dockerApi;
        this.datastore = datastore;
        this.buildLogs = buildLogs;
        this.activeBuilds = activeBuilds;
        //
    }
    getDirectoryForRawSource(appName, version) {
        return (CaptainConstants.captainRawSourceDirectoryBase +
            '/' +
            appName +
            '/' +
            version);
    }
    /**
     * Creates image if necessary, or just simply passes the image name
     */
    ensureImage(source, appName, appVersion) {
        const self = this;
        this.activeBuilds[appName] = true;
        this.buildLogs[appName] =
            this.buildLogs[appName] ||
                new BuildLog(CaptainConstants.configs.buildLogSize);
        this.buildLogs[appName].clear();
        this.buildLogs[appName].log('------------------------- ' + new Date());
        this.buildLogs[appName].log('Build started for ' + appName);
        let gitHash = '';
        const baseDir = self.getDirectoryForRawSource(appName, appVersion);
        const rawDir = baseDir + '/' + RAW_SOURCE_DIRECTORY;
        const tarFilePath = baseDir + '/' + TAR_FILE_NAME_READY_FOR_DOCKER;
        const baseImageNameWithoutVerAndReg = self.datastore.getBuiltImageNameBase(appName); // img-captain--myapp
        let fullImageName = ''; // repo.domain.com:998/username/reponame:8
        return Promise.resolve() //
            .then(function () {
            return self.ensureDirectoryWithCaptainDefinition(source, rawDir);
        })
            .then(function (gitHashFromImageSource) {
            gitHash = gitHashFromImageSource;
            // some users convert the directory into TAR instead of converting the content into TAR.
            // we go one level deep and try to find the right directory.
            return self.correctDirectoryAndEnsureCaptainDefinition(rawDir);
        })
            .then(function (correctedDir) {
            return self
                .getCaptainDefinition(correctedDir)
                .then(function (captainDefinition) {
                if (captainDefinition.imageName) {
                    self.buildLogs[appName].log(`An explicit image name was provided (${captainDefinition.imageName}). Therefore, no build process is needed.`);
                    self.buildLogs[appName].log(`The app (${appName}) will be re-deployed with this image: ${captainDefinition.imageName}`);
                    return captainDefinition.imageName + '';
                }
                return self.getBuildPushAndReturnImageName(captainDefinition, correctedDir, tarFilePath, baseImageNameWithoutVerAndReg, appName, appVersion);
            });
        })
            .then(function (ret) {
            fullImageName = ret;
        })
            .then(function () {
            return fs.remove(baseDir);
        })
            .then(function () {
            if (source.uploadedTarPathSource) {
                return fs.remove(source.uploadedTarPathSource.uploadedTarPath);
            }
        })
            .catch(function (err) {
            return fs
                .remove(baseDir)
                .then(function () {
                throw new Error('ensure catch');
            })
                .catch(function () {
                return Promise.reject(err);
            });
        })
            .catch(function (err) {
            if (source.uploadedTarPathSource) {
                return fs
                    .remove(source.uploadedTarPathSource.uploadedTarPath)
                    .then(function () {
                    throw new Error('ensure catch');
                })
                    .catch(function () {
                    return Promise.reject(err);
                });
            }
            return Promise.reject(err);
        })
            .then(function () {
            self.activeBuilds[appName] = false;
            return {
                imageName: fullImageName,
                gitHash: gitHash,
            };
        })
            .catch(function (error) {
            self.activeBuilds[appName] = false;
            return Promise.reject(error);
        });
    }
    getBuildPushAndReturnImageName(captainDefinition, correctedDirProvided, tarFilePath, baseImageNameWithoutVersionAndReg, appName, appVersion) {
        const self = this;
        return Promise.resolve() //
            .then(function () {
            return self
                .convertCaptainDefinitionToDockerfile(captainDefinition, correctedDirProvided)
                .then(function () {
                return self.convertContentOfDirectoryIntoTar(correctedDirProvided, tarFilePath);
            })
                .then(function () {
                return self.dockerApi
                    .buildImageFromDockerFile(baseImageNameWithoutVersionAndReg, appVersion, tarFilePath, self.buildLogs[appName])
                    .catch(function (error) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.BUILD_ERROR, ('' + error).trim());
                });
            })
                .then(function () {
                return self.dockerRegistryHelper.retagAndPushIfDefaultPushExist(baseImageNameWithoutVersionAndReg, appVersion, self.buildLogs[appName]);
            });
        });
    }
    /**
     * Returns a promise that resolve to path a directory where source files + captain definition
     *
     * @param source        the image source
     * @param destDirectory the path to directory where we want to have all our contents
     */
    ensureDirectoryWithCaptainDefinition(source, destDirectory) {
        return Promise.resolve() //
            .then(function () {
            return fs.ensureDir(destDirectory);
        })
            .then(function () {
            // If uploadedTarPath then extract into a directory
            //
            // If Repo then download.
            //
            // If captainDefinitionContent then create a directory and output to a directory
            //
            // Else THROW ERROR
            const srcTar = source.uploadedTarPathSource;
            if (srcTar) {
                // extract file to to destDirectory
                return tar
                    .extract({
                    file: srcTar.uploadedTarPath,
                    cwd: destDirectory,
                })
                    .then(function () {
                    return srcTar.gitHash;
                });
            }
            const srcRepo = source.repoInfoSource;
            if (srcRepo) {
                return GitHelper.clone(srcRepo.user, srcRepo.password, srcRepo.repo, srcRepo.branch, destDirectory).then(function () {
                    return GitHelper.getLastHash(destDirectory);
                });
            }
            const captainDefinitionContentSource = source.captainDefinitionContentSource;
            if (captainDefinitionContentSource) {
                return fs
                    .outputFile(destDirectory + '/' + CAPTAIN_DEFINITION_FILE, captainDefinitionContentSource.captainDefinitionContent)
                    .then(function () {
                    return captainDefinitionContentSource.gitHash;
                });
            }
            // we should never get here!
            throw new Error('Source is unknown!');
        });
    }
    getAllChildrenOfDirectory(directory) {
        return Promise.resolve() //
            .then(function () {
            return new Promise(function (resolve, reject) {
                fs.readdir(directory, function (err, files) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(files);
                });
            });
        });
    }
    getCaptainDefinition(directoryWithCaptainDefinition) {
        return Promise.resolve() //
            .then(function () {
            return fs.readJson(directoryWithCaptainDefinition +
                '/' +
                CAPTAIN_DEFINITION_FILE);
        })
            .then(function (data) {
            if (!data) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Captain Definition File is empty!');
            }
            if (!data.schemaVersion) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Captain Definition version is empty!');
            }
            if (data.schemaVersion !== 2) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Captain Definition version is not supported! Read migration guides to schemaVersion 2');
            }
            const hasTemplateIdTag = !!data.templateId;
            const hasImageName = !!data.imageName;
            const hasDockerfileLines = data.dockerfileLines && data.dockerfileLines.length > 0;
            let numberOfProperties = (hasTemplateIdTag ? 1 : 0) +
                (hasImageName ? 1 : 0) +
                (hasDockerfileLines ? 1 : 0);
            if (numberOfProperties !== 1) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'One, and only one, of these properties should be present in captain-definition: templateId, imageName, or, hasDockerfileLines');
            }
            return data;
        });
    }
    convertCaptainDefinitionToDockerfile(captainDefinition, directoryWithCaptainDefinition) {
        const self = this;
        return Promise.resolve() //
            .then(function () {
            let data = captainDefinition;
            if (data.templateId) {
                return TemplateHelper.get().getDockerfileContentFromTemplateTag(data.templateId);
            }
            else if (data.dockerfileLines) {
                return data.dockerfileLines.join('\n');
            }
            else if (data.imageName) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'ImageName cannot lead to a dockerfile');
            }
            else {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Dockerfile or TemplateId must be present. Both should not be present at the same time');
            }
        })
            .then(function (dockerfileContent) {
            return fs.outputFile(directoryWithCaptainDefinition + '/' + DOCKER_FILE, dockerfileContent);
        });
    }
    correctDirectoryAndEnsureCaptainDefinition(originalDirectory) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            // make sure if you need to go to child directory
            return fs.pathExists(originalDirectory + '/' + CAPTAIN_DEFINITION_FILE);
        })
            .then(function (exists) {
            if (exists)
                return originalDirectory;
            // check if there is only one child
            // check if it's a directory
            // check if captain definition exists in it
            // if so, return the child directory
            return self
                .getAllChildrenOfDirectory(originalDirectory)
                .then(function (files) {
                if (files.length !== 1 ||
                    !fs
                        .statSync(path.join(originalDirectory, files[0]))
                        .isDirectory()) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Captain Definition file does not exist!');
                }
                return path.join(originalDirectory, files[0]);
            });
        });
    }
    convertContentOfDirectoryIntoTar(sourceDirectory, tarFilePath) {
        return Promise.resolve() //
            .then(function () {
            return tar.c({
                file: tarFilePath,
                cwd: sourceDirectory,
            }, ['./']);
        });
    }
}
exports.default = ImageMaker;
//# sourceMappingURL=ImageMaker.js.map