import CaptainConstants = require("../utils/CaptainConstants");
import Logger = require("../utils/Logger");
import fs = require("fs-extra");
import uuid = require("uuid/v4");
import ApiStatusCodes = require("../api/ApiStatusCodes");
import DockerApi = require("../docker/DockerApi");

const CAPTAIN_WEBROOT_PATH_CERTBOT = "/captain-webroot";

const shouldUseStaging = false; // CaptainConstants.isDebug;

class CertbotManager {

    constructor(private dockerApi: DockerApi) {
        this.dockerApi = dockerApi;
    }

    domainValidOrThrow(domainName: string) {

        if (!domainName) {
            throw new Error("Domain Name is empty");
        }

        const RegExpression = /^[a-z0-9\.\-]*$/;

        if (!RegExpression.test(domainName)) {
            throw new Error("Bad Domain Name!");
        }

    }

    getCertRelativePathForDomain(domainName: string) {

        const self = this;

        self.domainValidOrThrow(domainName);

        return "/live/" + domainName + "/fullchain.pem";
    }

    getKeyRelativePathForDomain(domainName: string) {

        const self = this;

        self.domainValidOrThrow(domainName);

        return "/live/" + domainName + "/privkey.pem";
    }

    enableSsl(domainName: string) {
        const dockerApi = this.dockerApi;
        const self = this;

        Logger.d("Enabling SSL for " + domainName);

        self.domainValidOrThrow(domainName);

        return Promise.resolve()
            .then(function () {

                const webrootInCaptainContainer = CaptainConstants.captainStaticFilesDir +
                    CaptainConstants.nginxDomainSpecificHtmlDir +
                    "/" + domainName;

                return fs.ensureDir(webrootInCaptainContainer);

            })
            .then(function () {

                const cmd = ["certbot", "certonly", "--webroot",
                    "-w", CAPTAIN_WEBROOT_PATH_CERTBOT + "/" + domainName,
                    "-d", domainName, "--non-interactive"
                ];

                if (shouldUseStaging) {
                    cmd.push("--staging");
                }

                return self
                    .runCommand(cmd)
                    .then(function (output) {

                        Logger.d(output);

                        if (output.indexOf("Congratulations! Your certificate and chain have been saved") >= 0) {
                            return true;
                        }

                        if (output.indexOf("Certificate not yet due for renewal; no action taken") >= 0) {
                            return true;
                        }

                        throw ApiStatusCodes.createError(ApiStatusCodes.VERIFICATION_FAILED,
                            "Unexpected output when enabling SSL for" + domainName + " with ACME Certbot \n" + output);

                    });

            });
    }

    ensureRegistered(emailAddress: string) {

        const dockerApi = this.dockerApi;
        const self = this;

        return Promise.resolve()
            .then(function () {

                const rootPathDir = CaptainConstants.letsEncryptEtcPath + "/accounts/acme-" +
                    (shouldUseStaging ? "staging" : "v01") +
                    ".api.letsencrypt.org/directory";

                if (!fs.existsSync(rootPathDir)) {
                    Logger.d("Fresh install of Certbot. There is no registration directory");
                    return undefined;
                }

                const files = fs.readdirSync(rootPathDir);

                if (files.length === 0) {
                    Logger.d("Fresh install of Certbot. There is nothing in the registration directory");
                    return undefined;
                }

                if (files.length !== 1) {
                    throw new Error("I do not know know what to do when there are multiple directories in " + rootPathDir);
                }

                const regFilePath = rootPathDir + "/" + files[0] + "/regr.json";

                if (!fs.existsSync(regFilePath)) {
                    throw new Error("ACME Reg directory exists, but there is no file! " + regFilePath);
                }

                return fs.readJson(regFilePath);

            })
            .then(function (regrContent) {

                if (!regrContent) {

                    const cmd = ["certbot", "register",
                        "--email", emailAddress,
                        "--agree-tos", "--no-eff-email", "--non-interactive"
                    ];

                    if (shouldUseStaging) {
                        cmd.push("--staging");
                    }

                    return self
                        .runCommand(cmd)
                        .then(function (registerOutput) {

                            if (registerOutput.indexOf("Your account credentials have been saved in your Certbot") >= 0) {
                                return true;
                            }

                            throw new Error("Unexpected output when registering with ACME Certbot \n" + registerOutput);

                        });
                } else {

                    /*

                    /etc/letsencrypt/accounts/acme-v01.api.letsencrypt.org/directory/864339b5816d33d67743 # cat regr.json

                        {
                           "body":{
                              "contact":[
                                 "mailto:testemail@gmail.com"
                              ],
                              "agreement":"https://letsencrypt.org/documents/LE-SA-v1.1.1-August-1-2016.pdf",
                              "key":{
                                 "e":"AQAB",
                                 "kty":"RSA",
                                 "n":"1l-5ihAl0BFSiS3Pl3LjQ"
                              }
                           },
                           "uri":"https://acme-v01.api.letsencrypt.org/acme/reg/0421",
                           "new_authzr_uri":"https://acme-v01.api.letsencrypt.org/acme/new-authz",
                           "terms_of_service":"https://letsencrypt.org/documents/LE-SA-v1.1.1-August-1-2016.pdf"
                        }

                     */

                    let contact = undefined;

                    if (regrContent && regrContent.body && regrContent.body.contact && Array.isArray(regrContent.body.contact)) {
                        contact = regrContent.body.contact;
                        for (let idx = 0; idx < contact.length; idx++) {
                            if (contact[idx] === ("mailto:" + emailAddress)) {
                                return true;
                            }
                        }
                    }

                    throw new Error("Previously registered with a different address: " + contact ? JSON.stringify(contact) : "NULL");
                }
            });

    }

    runCommand(cmd: string[]) {

        const dockerApi = this.dockerApi;
        const self = this;

        return Promise.resolve()
            .then(function () {
                return dockerApi.executeCommand(CaptainConstants.certbotServiceName, cmd);
            });
    }

    renewAllCerts() {

        const self = this;

        /*
        From Certbot docs:
            This command attempts to renew any previously-obtained certificates that expire in less than 30 days.
            The same plugin and options that were used at the time the certificate was originally issued will be
            used for the renewal attempt, unless you specify other plugins or options. Unlike certonly, renew
            acts on multiple certificates and always takes into account whether each one is near expiry. Because
            of this, renew is suitable (and designed) for automated use, to allow your system to automatically
            renew each certificate when appropriate. Since renew only renews certificates that are near expiry
            it can be run as frequently as you want - since it will usually take no action.
         */

        // before doing anything, let's schedule the next one in 20.3 hours!
        // this random schedule helps to avoid retrying at the same time of
        // the day in case if that's our super high traffic time

        setTimeout(function () {
            self.renewAllCerts();
        }, 1000 * 3600 * 20.3);

        const cmd = ["certbot", "renew"];

        if (shouldUseStaging) {
            cmd.push("--staging");
        }

        return self
            .runCommand(cmd)
            .then(function (output) {

                // Ignore output :)

            });
    }

    init(myNodeId: string) {

        const dockerApi = this.dockerApi;
        const self = this;

        const domainSpecificRootDirectoryInHost = CaptainConstants.captainStaticFilesDir + CaptainConstants.nginxDomainSpecificHtmlDir;

        function createCertbotServiceOnNode(nodeId: string) {

            return dockerApi.createServiceOnNodeId(CaptainConstants.certbotImageName,
                    CaptainConstants.certbotServiceName, undefined, nodeId, undefined, undefined, undefined)
                .then(function () {

                    const waitTimeInMillis = 5000;
                    Logger.d("Waiting for " + (waitTimeInMillis / 1000) + " seconds for Certbot to start up");
                    return new Promise(function (resolve, reject) {
                        setTimeout(function () {
                            resolve(true);
                        }, waitTimeInMillis);
                    });
                });
        }

        return Promise.resolve()
            .then(function () {

                return fs.ensureDir(CaptainConstants.letsEncryptEtcPath);

            })
            .then(function () {

                return fs.ensureDir(CaptainConstants.letsEncryptLibPath);

            })
            .then(function () {

                return fs.ensureDir(domainSpecificRootDirectoryInHost);

            })
            .then(function () {

                return dockerApi
                    .isServiceRunningByName(CaptainConstants.certbotServiceName);

            })
            .then(function (isRunning) {

                if (isRunning) {

                    Logger.d("Captain Certbot is already running.. ");

                    return dockerApi
                        .getNodeIdByServiceName(CaptainConstants.certbotServiceName, 0);

                } else {

                    Logger.d("No Captain Certbot service is running. Creating one...");

                    return createCertbotServiceOnNode(myNodeId)
                        .then(function () {
                            return myNodeId;
                        });
                }

            })
            .then(function (nodeId) {

                if (nodeId !== myNodeId) {

                    Logger.d("Captain Certbot is running on a different node. Removing...");

                    return dockerApi
                        .removeServiceByName(CaptainConstants.certbotServiceName)
                        .then(function () {

                            return createCertbotServiceOnNode(myNodeId)
                                .then(function () {

                                    return true;

                                });
                        });

                } else {

                    return true;

                }
            })
            .then(function () {
                Logger.d("Updating Certbot service...");

                return dockerApi.updateService(CaptainConstants.certbotServiceName, undefined, [{
                            hostPath: CaptainConstants.letsEncryptEtcPath,
                            containerPath: "/etc/letsencrypt"
                        },
                        {
                            hostPath: CaptainConstants.letsEncryptLibPath,
                            containerPath: "/var/lib/letsencrypt"
                        },
                        {
                            hostPath: domainSpecificRootDirectoryInHost,
                            containerPath: CAPTAIN_WEBROOT_PATH_CERTBOT
                        }
                    ]
                    // No need to certbot to be connected to the network
                , undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);

            })
            .then(function () {

                // schedule the first attempt to renew certs in 1 minute
                setTimeout(function () {
                    self.renewAllCerts();
                }, 1000 * 60);

            });
    }

}

export = CertbotManager;