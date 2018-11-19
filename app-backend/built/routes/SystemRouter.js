var express = require('express');
var router = express.Router();
var BaseApi = require('../api/BaseApi');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var Logger = require('../utils/Logger');
var CaptainManager = require('../user/CaptainManager');
var Validator = require('validator');
var CaptainConstants = require('../utils/CaptainConstants');
var RegistriesRouter = require('./RegistriesRouter');
router.use('/registries/', RegistriesRouter);
router.post('/changerootdomain/', function (req, res, next) {
    var requestedCustomDomain = (req.body.rootDomain || '').toLowerCase();
    function replaceAll(target, search, replacement) {
        return target.replace(new RegExp(search, 'g'), replacement);
    }
    requestedCustomDomain = replaceAll(requestedCustomDomain, 'https://', '');
    requestedCustomDomain = replaceAll(requestedCustomDomain, 'http://', '');
    if (!requestedCustomDomain ||
        requestedCustomDomain.length < 3 ||
        requestedCustomDomain.indexOf('/') >= 0 ||
        requestedCustomDomain.indexOf(':') >= 0 ||
        requestedCustomDomain.indexOf('%') >= 0 ||
        requestedCustomDomain.indexOf(' ') >= 0 ||
        requestedCustomDomain.indexOf('\\') >= 0) {
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Bad domain name.'));
        return;
    }
    CaptainManager.get().changeCaptainRootDomain(requestedCustomDomain)
        .then(function () {
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Root domain changed.'));
    })
        .catch(function (error) {
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
        }
        else {
            Logger.e(error);
            res.sendStatus(500);
        }
    });
});
router.post('/enablessl/', function (req, res, next) {
    var emailAddress = req.body.emailAddress || '';
    if (!emailAddress ||
        emailAddress.length < 3 ||
        emailAddress.indexOf('/') >= 0 ||
        emailAddress.indexOf(':') >= 0 ||
        emailAddress.indexOf('%') >= 0 ||
        emailAddress.indexOf(' ') >= 0 ||
        emailAddress.indexOf('\\') >= 0 ||
        !Validator.isEmail(emailAddress)) {
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Bad email address.'));
        return;
    }
    CaptainManager.get()
        .enableSsl(emailAddress)
        .then(function () {
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Root SSL Enabled.'));
    })
        .catch(function (error) {
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
        }
        else {
            Logger.e(error); //
            res.sendStatus(500); //
        }
    });
});
router.post('/forcessl/', function (req, res, next) {
    var isEnabled = !!req.body.isEnabled;
    CaptainManager.get()
        .forceSsl(isEnabled)
        .then(function () {
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, 'Non-SSL traffic is now ' + (isEnabled ? 'rejected.' : 'allowed.')));
    })
        .catch(function (error) {
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
        }
        else {
            Logger.e(error);
            res.sendStatus(500);
        }
    });
});
router.post('/enableregistryssl/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
        return CaptainManager.get().getDockerRegistry().enableRegistrySsl();
    })
        .then(function () {
        var msg = 'General SSL is enabled for docker registry.';
        Logger.d(msg);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.post('/enableregistry/', function (req, res, next) {
    var LOCAL = 'local';
    var REMOTE = 'remote';
    var isLocal = req.body.registryType === LOCAL;
    var isRemote = req.body.registryType === REMOTE;
    var captainManager = CaptainManager.get();
    return Promise.resolve()
        .then(function () {
        if (isLocal) {
            return captainManager.getDockerRegistry().ensureDockerRegistryRunningOnThisNode();
        }
        else if (isRemote) {
            return true; // remote registry is already created :p we just need to update the credentials
        }
        else {
            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Registry type is not known.');
        }
    })
        .then(function () {
        var user = req.body.registryUser;
        var pass = req.body.registryPassword;
        var domain = req.body.registryDomain;
        if (isLocal) {
            user = CaptainConstants.captainRegistryUsername;
            pass = captainManager.getCaptainSalt();
            domain = captainManager.getDockerRegistry().getLocalRegistryDomainAndPort();
        }
        return captainManager.getDockerRegistry().updateRegistryAuthHeader(user, pass, domain);
    })
        .then(function () {
        if (isLocal) {
            return captainManager.getDockerRegistry().enableLocalDockerRegistry();
        }
        return true;
    })
        .then(function () {
        var msg = 'Local registry is created.';
        Logger.d(msg);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));
    })
        .then(function () {
        return captainManager.resetSelf();
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.get('/info/', function (req, res, next) {
    var dataStore = res.locals.user.dataStore;
    return Promise.resolve()
        .then(function () {
        return dataStore.getHasRootSsl();
    })
        .then(function (hasRootSsl) {
        var dockerRegistryAuthObj = CaptainManager.get().getDockerAuthObject();
        return {
            dockerRegistryDomain: dockerRegistryAuthObj ? dockerRegistryAuthObj.serveraddress : '',
            hasRootSsl: hasRootSsl,
            forceSsl: CaptainManager.get().getForceSslValue(),
            rootDomain: dataStore.hasCustomDomain() ? dataStore.getRootDomain() : ''
        };
    })
        .then(function (data) {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Captain info retrieved');
        baseApi.data = data;
        res.send(baseApi);
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.get('/loadbalancerinfo/', function (req, res, next) {
    var dataStore = res.locals.user.dataStore;
    return Promise.resolve()
        .then(function () {
        return CaptainManager.get().getLoadBalanceManager().getInfo();
    })
        .then(function (data) {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Load Balancer info retrieved');
        baseApi.data = data;
        res.send(baseApi);
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.get('/versionInfo/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
        return CaptainManager.get().getCaptainImageTags();
    })
        .then(function (tagList) {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Version Info Retrieved');
        var currentVersion = CaptainConstants.version.split('.');
        var latestVersion = CaptainConstants.version.split('.');
        var canUpdate = false;
        for (var i = 0; i < tagList.length; i++) {
            var tag = tagList[i].split('.');
            if (tag.length !== 3) {
                continue;
            }
            if (Number(tag[0]) > Number(currentVersion[0])) {
                canUpdate = true;
                latestVersion = tag;
                break;
            }
            else if (Number(tag[0]) === Number(currentVersion[0]) && Number(tag[1]) > Number(currentVersion[1])) {
                canUpdate = true;
                latestVersion = tag;
                break;
            }
            else if (Number(tag[0]) === Number(currentVersion[0]) && Number(tag[1]) === Number(currentVersion[1]) && Number(tag[2]) > Number(currentVersion[2])) {
                canUpdate = true;
                latestVersion = tag;
                break;
            }
        }
        baseApi.data = {
            currentVersion: currentVersion.join('.'),
            latestVersion: latestVersion.join('.'),
            canUpdate: canUpdate
        };
        res.send(baseApi);
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.post('/versionInfo/', function (req, res, next) {
    var latestVersion = req.body.latestVersion;
    return Promise.resolve()
        .then(function () {
        return CaptainManager.get().updateCaptain(latestVersion);
    })
        .then(function () {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Captain update process has started...');
        res.send(baseApi);
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.get('/netdata/', function (req, res, next) {
    var dataStore = res.locals.user.dataStore;
    return Promise.resolve()
        .then(function () {
        return dataStore.getNetDataInfo();
    })
        .then(function (data) {
        data.netDataUrl = CaptainConstants.captainSubDomain + '.' + dataStore.getRootDomain() + CaptainConstants.netDataRelativePath;
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Netdata info retrieved');
        baseApi.data = data;
        res.send(baseApi);
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.post('/netdata/', function (req, res, next) {
    var netDataInfo = req.body.netDataInfo;
    netDataInfo.netDataUrl = undefined; // Frontend app returns this value, but we really don't wanna save this.
    // root address is subject to change.
    return Promise.resolve()
        .then(function () {
        return CaptainManager.get().updateNetDataInfo(netDataInfo);
    })
        .then(function () {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Netdata info is updated');
        res.send(baseApi);
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.get('/nginxconfig/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
        return CaptainManager.get().getNginxConfig();
    })
        .then(function (data) {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Nginx config retrieved');
        baseApi.data = data;
        res.send(baseApi);
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.post('/nginxconfig/', function (req, res, next) {
    var baseConfigCustomValue = req.body.baseConfig.customValue;
    var captainConfigCustomValue = req.body.captainConfig.customValue;
    return Promise.resolve()
        .then(function () {
        return CaptainManager.get().setNginxConfig(baseConfigCustomValue, captainConfigCustomValue);
    })
        .then(function () {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Nginx config is updated');
        res.send(baseApi);
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.get('/nodes/', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
        return CaptainManager.get().getNodesInfo();
    })
        .then(function (data) {
        var baseApi = new BaseApi(ApiStatusCodes.STATUS_OK, 'Node info retrieved');
        baseApi.data = data;
        res.send(baseApi);
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
router.post('/nodes/', function (req, res, next) {
    var MANAGER = 'manager';
    var WORKER = 'worker';
    var isManager = null;
    if (req.body.nodeType === MANAGER) {
        isManager = true;
    }
    else if (req.body.nodeType === WORKER) {
        isManager = false;
    }
    else {
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Node type should be either manager or worker'));
        return;
    }
    var privateKey = req.body.privateKey;
    var remoteNodeIpAddress = req.body.remoteNodeIpAddress;
    var remoteUserName = req.body.remoteUserName;
    var captainIpAddress = req.body.captainIpAddress;
    if (!captainIpAddress || !remoteNodeIpAddress || !remoteUserName || !privateKey) {
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Private Key, Captain IP address, remote IP address and remote username should all be present'));
        return;
    }
    return Promise.resolve()
        .then(function () {
        if (!CaptainManager.get().getDockerAuthObject()) {
            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Docker Registry is not attached yet. To add a node, you must first enable a docker registry');
        }
    })
        .then(function () {
        return CaptainManager.get().joinDockerNode(captainIpAddress, isManager, remoteNodeIpAddress, remoteUserName, privateKey);
    })
        .then(function () {
        var msg = 'Docker node is successfully joined.';
        Logger.d(msg);
        res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg));
    })
        .catch(function (error) {
        Logger.e(error);
        if (error && error.captainErrorType) {
            res.send(new BaseApi(error.captainErrorType, error.apiMessage));
            return;
        }
        res.sendStatus(500);
    });
});
module.exports = router;
