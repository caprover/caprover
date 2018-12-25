"use strict";
const ApiStatusCodes = require("../api/ApiStatusCodes");
const Logger = require("../utils/Logger");
const CaptainConstants = require("../utils/CaptainConstants");
class DockerRegistryHelper {
    constructor(dataStore, dockerApi) {
        this.dockerApi = dockerApi;
        this.registriesDataStore = dataStore.getRegistriesDataStore();
    }
    retagAndPushIfDefaultPushExist(imageName, version, buildLogs) {
        const self = this;
        let allRegistries;
        let fullImageName = imageName + ':' + version;
        return Promise.resolve() //
            .then(function () {
            if (!imageName)
                throw new Error('no image name! cannot re-tag!');
            if (imageName.indexOf('/') >= 0 || imageName.indexOf(':') >= 0)
                throw new Error('ImageName should not contain "/" or ":" before re-tagging!');
            return self.getAllRegistries();
        })
            .then(function (data) {
            allRegistries = data;
            return self.getDefaultPushRegistryId();
        })
            .then(function (defaultRegId) {
            let ret = undefined;
            for (let idx = 0; idx < allRegistries.length; idx++) {
                const element = allRegistries[idx];
                if (defaultRegId && element.id === defaultRegId) {
                    return element;
                }
            }
            return ret;
        })
            .then(function (data) {
            if (!data)
                return fullImageName;
            fullImageName =
                data.registryDomain +
                    '/' +
                    data.registryImagePrefix +
                    '/' +
                    fullImageName;
            return self
                .getDockerAuthObjectForImageName(fullImageName)
                .then(function (authObj) {
                if (!authObj) {
                    throw new Error('Docker Auth Object is NULL just after re-tagging! Something is wrong!');
                }
                Logger.d('Docker Auth is found. Pushing the image...');
                return self.dockerApi
                    .pushImage(fullImageName, authObj, buildLogs)
                    .catch(function (error) {
                    return new Promise(function (resolve, reject) {
                        Logger.e('PUSH FAILED');
                        Logger.e(error);
                        reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Push failed: ' + error));
                    });
                });
            })
                .then(function () {
                return fullImageName;
            });
        });
    }
    getDockerAuthObjectForImageName(imageName) {
        const self = this;
        return Promise.resolve() //
            .then(function () {
            //
            return self.getAllRegistries();
        })
            .then(function (regs) {
            for (let index = 0; index < regs.length; index++) {
                const element = regs[index];
                const prefix = element.registryImagePrefix;
                const registryIdentifierPrefix = element.registryDomain +
                    (prefix ? '/' + prefix : '') +
                    '/';
                if (imageName.startsWith(registryIdentifierPrefix)) {
                    return {
                        serveraddress: element.registryDomain,
                        username: element.registryUser,
                        password: element.registryPassword,
                        email: CaptainConstants.defaultEmail,
                    };
                }
            }
            return undefined;
        });
    }
    setDefaultPushRegistry(registryId) {
        const self = this;
        return Promise.resolve().then(function () {
            return self.registriesDataStore.setDefaultPushRegistryId(registryId);
        });
    }
    getDefaultPushRegistryId() {
        const self = this;
        return Promise.resolve().then(function () {
            return self.registriesDataStore.getDefaultPushRegistryId();
        });
    }
    deleteRegistry(registryId, allowLocalDelete) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.getDefaultPushRegistryId();
        })
            .then(function (registryIdDefaultPush) {
            if (registryId === registryIdDefaultPush) {
                throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_PARAMETER, 'Cannot remove the default push. First change the default push.');
            }
            return self.registriesDataStore.getRegistryById(registryId);
        })
            .then(function (registry) {
            if (registry.registryType === IRegistryTypes.LOCAL_REG &&
                !allowLocalDelete) {
                throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_OPERATION, 'You cannot delete self-hosted registry.');
            }
            return self.registriesDataStore.deleteRegistry(registryId);
        });
    }
    getAllRegistries() {
        const self = this;
        return Promise.resolve().then(function () {
            return self.registriesDataStore.getAllRegistries();
        });
    }
    addRegistry(registryUser, registryPassword, registryDomain, registryImagePrefix, registryType) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.registriesDataStore.getAllRegistries();
        })
            .then(function (allRegs) {
            let promiseToAddRegistry = self.registriesDataStore.addRegistryToDb(registryUser, registryPassword, registryDomain, registryImagePrefix, registryType);
            // Product decision. We want to make the first added registry the default one,
            // this way, it's easier for new users to grasp the concept of default push registry.
            if (allRegs.length === 0) {
                promiseToAddRegistry = promiseToAddRegistry //
                    .then(function (idOfNewReg) {
                    return self.registriesDataStore
                        .setDefaultPushRegistryId(idOfNewReg)
                        .then(function () {
                        return idOfNewReg;
                    });
                });
            }
            return promiseToAddRegistry;
        });
    }
    updateRegistry(id, registryUser, registryPassword, registryDomain, registryImagePrefix) {
        const self = this;
        return Promise.resolve().then(function () {
            return self.registriesDataStore.updateRegistry(id, registryUser, registryPassword, registryDomain, registryImagePrefix);
        });
    }
}
module.exports = DockerRegistryHelper;
//# sourceMappingURL=DockerRegistryHelper.js.map