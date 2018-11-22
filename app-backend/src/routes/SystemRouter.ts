import express = require("express");
import BaseApi = require("../api/BaseApi");
import ApiStatusCodes = require("../api/ApiStatusCodes");
import Logger = require("../utils/Logger");
import CaptainManager = require("../user/CaptainManager");
import Validator = require("validator");
import CaptainConstants = require("../utils/CaptainConstants");
import RegistriesRouter = require("./RegistriesRouter");

const router = express.Router();

router.use("/registries/", RegistriesRouter);

router.post("/changerootdomain/", function(req, res, next) {

    let requestedCustomDomain = (req.body.rootDomain || "").toLowerCase();

    function replaceAll(target: string, search: string, replacement: string) {
        return target.replace(new RegExp(search, "g"), replacement);
    }

    requestedCustomDomain = replaceAll(requestedCustomDomain, "https://", "");
    requestedCustomDomain = replaceAll(requestedCustomDomain, "http://", "");

    if (
        !requestedCustomDomain ||
        requestedCustomDomain.length < 3 ||
        requestedCustomDomain.indexOf("/") >= 0 ||
        requestedCustomDomain.indexOf(":") >= 0 ||
        requestedCustomDomain.indexOf("%") >= 0 ||
        requestedCustomDomain.indexOf(" ") >= 0 ||
        requestedCustomDomain.indexOf("\\") >= 0
    ) {
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, "Bad domain name."));
        return;
    }

    CaptainManager.get().changeCaptainRootDomain(requestedCustomDomain)
        .then(function() {
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, "Root domain changed."));
        })
        .catch(function(error) {
            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            } else {
                Logger.e(error);
                res.sendStatus(500);
            }
        });
});


router.post("/enablessl/", function(req, res, next) {

    const emailAddress = req.body.emailAddress || "";

    if (
        !emailAddress ||
        emailAddress.length < 3 ||
        emailAddress.indexOf("/") >= 0 ||
        emailAddress.indexOf(":") >= 0 ||
        emailAddress.indexOf("%") >= 0 ||
        emailAddress.indexOf(" ") >= 0 ||
        emailAddress.indexOf("\\") >= 0 ||
        !Validator.isEmail(emailAddress)
    ) {
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, "Bad email address."));
        return;
    }

    CaptainManager.get()
        .enableSsl(emailAddress)
        .then(function() {
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, "Root SSL Enabled."));
        })
        .catch(function(error) {
            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            } else {
                Logger.e(error); //
                res.sendStatus(500); //
            }
        });
});

router.post("/forcessl/", function(req, res, next) {

    let isEnabled = !!req.body.isEnabled;

    CaptainManager.get()
        .forceSsl(isEnabled)
        .then(function() {
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, "Non-SSL traffic is now " + (isEnabled ? "rejected." : "allowed.")));
        })
        .catch(function(error) {
            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            } else {
                Logger.e(error);
                res.sendStatus(500);
            }
        });
});


router.post("/enableregistryssl/", function(req, res, next) {

    return Promise.resolve()
        .then(function() {

            return CaptainManager.get().getDockerRegistry().enableRegistrySsl();

        })
        .then(function() {

            let msg = "General SSL is enabled for docker registry.";
            Logger.d(msg);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});

router.post("/enableregistry/", function(req, res, next) {


    const LOCAL = "local";
    const REMOTE = "remote";
    let isLocal = req.body.registryType === LOCAL;
    let isRemote = req.body.registryType === REMOTE;

    const captainManager = CaptainManager.get();

    return Promise.resolve()
        .then(function() {
            if (isLocal) {
                return captainManager.getDockerRegistry().ensureDockerRegistryRunningOnThisNode();
            } else if (isRemote) {
                return true; // remote registry is already created :p we just need to update the credentials
            } else {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Registry type is not known.");
            }
        })
        .then(function() {

            let user = req.body.registryUser;
            let pass = req.body.registryPassword;
            let domain = req.body.registryDomain;

            if (isLocal) {
                user = CaptainConstants.captainRegistryUsername;
                pass = captainManager.getCaptainSalt();
                domain = captainManager.getDockerRegistry().getLocalRegistryDomainAndPort();
            }

            return captainManager.getDockerRegistry().updateRegistryAuthHeader(user, pass, domain);

        })
        .then(function() {

            if (isLocal) {
                return captainManager.getDockerRegistry().enableLocalDockerRegistry();
            }

            return true;

        })
        .then(function() {

            let msg = "Local registry is created.";
            Logger.d(msg);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));

        })
        .then(function() {

            return captainManager.resetSelf();

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});

router.get("/info/", function(req, res, next) {

    const dataStore = res.locals.user.dataStore;

    return Promise.resolve()
        .then(function() {
            return dataStore.getHasRootSsl();
        })
        .then(function(hasRootSsl) {

            let dockerRegistryAuthObj = CaptainManager.get().getDockerAuthObject();

            return {
                dockerRegistryDomain: dockerRegistryAuthObj ? dockerRegistryAuthObj.serveraddress : "",
                hasRootSsl: hasRootSsl,
                forceSsl: CaptainManager.get().getForceSslValue(),
                rootDomain: dataStore.hasCustomDomain() ? dataStore.getRootDomain() : "",
            };

        })
        .then(function(data) {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Captain info retrieved");
            baseApi.data = data;
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});

router.get("/loadbalancerinfo/", function(req, res, next) {

    const dataStore = res.locals.user.dataStore;

    return Promise.resolve()
        .then(function() {
            return CaptainManager.get().getLoadBalanceManager().getInfo();
        })
        .then(function(data) {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Load Balancer info retrieved");
            baseApi.data = data;
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});

router.get("/versionInfo/", function(req, res, next) {

    return Promise.resolve()
        .then(function() {

            return CaptainManager.get().getCaptainImageTags();

        })
        .then(function(tagList) {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Version Info Retrieved");
            let currentVersion = CaptainConstants.version.split(".");
            let latestVersion = CaptainConstants.version.split(".");

            let canUpdate = false;

            for (let i = 0; i < tagList.length; i++) {

                let tag = tagList[i].split(".");

                if (tag.length !== 3) {
                    continue;
                }

                if (Number(tag[0]) > Number(currentVersion[0])) {
                    canUpdate = true;
                    latestVersion = tag;
                    break;
                } else if (Number(tag[0]) === Number(currentVersion[0]) && Number(tag[1]) > Number(currentVersion[1])) {
                    canUpdate = true;
                    latestVersion = tag;
                    break;
                } else if (Number(tag[0]) === Number(currentVersion[0]) && Number(tag[1]) === Number(currentVersion[1]) && Number(tag[2]) > Number(currentVersion[2])) {
                    canUpdate = true;
                    latestVersion = tag;
                    break;
                }
            }

            baseApi.data = {
                currentVersion: currentVersion.join("."),
                latestVersion: latestVersion.join("."),
                canUpdate: canUpdate,
            };

            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});

router.post("/versionInfo/", function(req, res, next) {

    let latestVersion = req.body.latestVersion;

    return Promise.resolve()
        .then(function() {

            return CaptainManager.get().updateCaptain(latestVersion);

        })
        .then(function() {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Captain update process has started...");
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });
});


router.get("/netdata/", function(req, res, next) {

    const dataStore = res.locals.user.dataStore;

    return Promise.resolve()
        .then(function() {

            return dataStore.getNetDataInfo();

        })
        .then(function(data) {

            data.netDataUrl = CaptainConstants.captainSubDomain + "." + dataStore.getRootDomain() + CaptainConstants.netDataRelativePath;
            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Netdata info retrieved");
            baseApi.data = data;
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});

router.post("/netdata/", function(req, res, next) {

    let netDataInfo = req.body.netDataInfo;
    netDataInfo.netDataUrl = undefined; // Frontend app returns this value, but we really don't wanna save this.
    // root address is subject to change.


    return Promise.resolve()
        .then(function() {

            return CaptainManager.get().updateNetDataInfo(netDataInfo);

        })
        .then(function() {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Netdata info is updated");
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });
});

router.get("/nginxconfig/", function(req, res, next) {

    return Promise.resolve()
        .then(function() {

            return CaptainManager.get().getNginxConfig();

        })
        .then(function(data) {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Nginx config retrieved");
            baseApi.data = data;
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});

router.post("/nginxconfig/", function(req, res, next) {

    let baseConfigCustomValue = req.body.baseConfig.customValue;
    let captainConfigCustomValue = req.body.captainConfig.customValue;

    return Promise.resolve()
        .then(function() {

            return CaptainManager.get().setNginxConfig(baseConfigCustomValue, captainConfigCustomValue);

        })
        .then(function() {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Nginx config is updated");
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });
});

router.get("/nodes/", function(req, res, next) {

    return Promise.resolve()
        .then(function() {

            return CaptainManager.get().getNodesInfo();

        })
        .then(function(data) {

            let baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, "Node info retrieved");
            baseApi.data = data;
            res.send(baseApi);

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});

router.post("/nodes/", function(req, res, next) {

    const MANAGER = "manager";
    const WORKER = "worker";

    let isManager: boolean;

    if (req.body.nodeType === MANAGER) {
        isManager = true;
    } else if (req.body.nodeType === WORKER) {
        isManager = false;
    } else {
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, "Node type should be either manager or worker"));
        return;
    }

    let privateKey = req.body.privateKey;
    let remoteNodeIpAddress = req.body.remoteNodeIpAddress;
    let remoteUserName = req.body.remoteUserName;
    let captainIpAddress = req.body.captainIpAddress;

    if (!captainIpAddress || !remoteNodeIpAddress || !remoteUserName || !privateKey) {
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, "Private Key, Captain IP address, remote IP address and remote username should all be present"));
        return;
    }

    return Promise.resolve()
        .then(function() {

            if (!CaptainManager.get().getDockerAuthObject()) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC,
                    "Docker Registry is not attached yet. To add a node, you must first enable a docker registry");
            }

        })
        .then(function() {

            return CaptainManager.get().joinDockerNode(captainIpAddress, isManager, remoteNodeIpAddress, remoteUserName, privateKey);

        })
        .then(function() {

            let msg = "Docker node is successfully joined.";
            Logger.d(msg);
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));

        })
        .catch(function(error) {

            Logger.e(error);

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }

            res.sendStatus(500);
        });

});


export = router;