import jwt = require("jsonwebtoken");
import DataStore = require("../datastore/DataStoreImpl");
import uuid = require("uuid/v4");
import bcrypt = require("bcryptjs");

import ApiStatusCodes = require("../api/ApiStatusCodes");
import EnvVar = require("../utils/EnvVars");
import CaptainManager = require("./CaptainManager");
import CaptainConstants = require("../utils/CaptainConstants");
import Logger = require("../utils/Logger");
import DataStoreProvider = require("../datastore/DataStoreProvider");
import { UserJwt } from "../models/InjectionInterfaces";

const captainDefaultPassword = EnvVar.DEFAULT_PASSWORD || "captain42";

const COOKIE_AUTH_SUFFIX = "cookie-";
const WEBHOOK_APP_PUSH_SUFFIX = "-webhook-app-push";
const WEBHOOK_APP_PUSH_DATASTORE_SUFFIX = "-webhook-app-datastore";

class Authenticator {
    private encryptionKey: string;
    private namespace: string;
    private tokenVersion: string;
    private dataStore: DataStore;

    constructor(secret: string, namespace: string, dataStore: DataStore) {
        this.encryptionKey = secret + namespace; // making encryption key unique per namespace!
        this.namespace = namespace;
        this.dataStore = dataStore;
        this.tokenVersion = CaptainConstants.isDebug ? "test" : uuid();
    }

    changepass(oldPass: string, newPass: string) {
        const self = this;

        oldPass = oldPass || "";
        newPass = newPass || "";

        return Promise.resolve()
            .then(function() {
                if (!oldPass || !newPass || newPass.length < 8) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        "Password is too small."
                    );
                }

                return self.isPasswordCorrect(oldPass);
            })
            .then(function(isPasswordCorrect) {
                if (!isPasswordCorrect) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_WRONG_PASSWORD,
                        "Old password is incorrect."
                    );
                }

                self.tokenVersion = uuid();

                const hashed = bcrypt.hashSync(
                    self.encryptionKey + newPass,
                    bcrypt.genSaltSync(10)
                );

                return self.dataStore.setHashedPassword(hashed);
            });
    }

    isPasswordCorrect(password: string) {
        const self = this;

        return self.dataStore
            .getHashedPassword()
            .then(function(savedHashedPassword) {
                password = password || "";

                if (!savedHashedPassword) {
                    return captainDefaultPassword === password;
                }

                return bcrypt.compareSync(
                    self.encryptionKey + password,
                    savedHashedPassword
                );
            });
    }

    getAuthTokenForCookies(password: string) {
        return this.getAuthToken(password, COOKIE_AUTH_SUFFIX);
    }

    getAuthToken(password: string, keySuffix?: string) {
        const self = this;

        return Promise.resolve()
            .then(function() {
                return self.isPasswordCorrect(password);
            })
            .then(function(isPasswordCorrect) {
                if (!isPasswordCorrect) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_WRONG_PASSWORD,
                        "Password is incorrect."
                    );
                }

                const userObj: UserJwt = {
                    namespace: self.namespace,
                    tokenVersion: self.tokenVersion,
                };

                return jwt.sign(
                    {
                        data: userObj,
                    },
                    self.encryptionKey + (keySuffix ? keySuffix : ""),
                    { expiresIn: "10000h" }
                );
            });
    }

    decodeAuthTokenFromCookies(token: string) {
        return this.decodeAuthToken(token, COOKIE_AUTH_SUFFIX);
    }

    decodeAuthToken(token: string, keySuffix?: string) {
        const self = this;

        return new Promise(function(resolve, reject) {
            jwt.verify(
                token,
                self.encryptionKey + (keySuffix ? keySuffix : ""),
                function(err, rawDecoded: any) {
                    if (err) {
                        Logger.e(err);
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID,
                                "Auth token corrupted"
                            )
                        );
                        return;
                    }

                    const decodedData = rawDecoded.data;

                    if (decodedData.tokenVersion !== self.tokenVersion) {
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID,
                                "Auth token is not valid anymore. Request for a new auth token"
                            )
                        );
                        return;
                    }

                    if (decodedData.namespace !== self.namespace) {
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID,
                                "Auth token does not match the namespace"
                            )
                        );
                        return;
                    }

                    resolve(decodedData);
                }
            );
        });
    }

    getAppPushWebhookDatastore(dataToSave: any) {
        const self = this;

        return self.getGenericToken(
            dataToSave,
            WEBHOOK_APP_PUSH_DATASTORE_SUFFIX
        );
    }

    decodeAppPushWebhookDatastore(token: string) {
        const self = this;

        return self.decodeGenericToken(token, WEBHOOK_APP_PUSH_DATASTORE_SUFFIX);
    }

    getAppPushWebhookToken(appName: string, tokenVersion: string) {
        const self = this;

        if (!appName) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                "App name are required for webhook token.."
            );
        }

        return self.getGenericToken(
            {
                tokenVersion: tokenVersion,
                appName: appName,
            },
            WEBHOOK_APP_PUSH_SUFFIX
        );
    }

    decodeAppPushWebhookToken(token: string) {
        const self = this;

        return self.decodeGenericToken(token, WEBHOOK_APP_PUSH_SUFFIX);
    }

    getGenericToken(obj: any, keySuffix: string) {
        const self = this;
        obj.namespace = self.namespace;

        return Promise.resolve().then(function() {
            return jwt.sign(
                {
                    data: obj,
                },
                self.encryptionKey + (keySuffix ? keySuffix : "")
            );
        });
    }

    decodeGenericToken(token: string, keySuffix: string) {
        const self = this;

        return new Promise(function(resolve, reject) {
            jwt.verify(
                token,
                self.encryptionKey + (keySuffix ? keySuffix : ""),
                function(err, rawDecoded: any) {
                    if (err) {
                        Logger.e(err);
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID,
                                "Token corrupted"
                            )
                        );
                        return;
                    }

                    const decodedData = rawDecoded.data;

                    if (decodedData.namespace !== self.namespace) {
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID,
                                "token does not match the namespace"
                            )
                        );
                        return;
                    }

                    resolve(decodedData);
                }
            );
        });
    }

    static get(namespace: string): Authenticator {
        if (!namespace) {
            throw new Error("namespace is needed");
        }

        if (!authenticatorCache[namespace]) {
            const captainSalt = CaptainManager.get().getCaptainSalt();
            if (captainSalt) {
                authenticatorCache[namespace] = new Authenticator(
                    captainSalt,
                    namespace,
                    DataStoreProvider.getDataStore(namespace)
                );
            }
        }

        return authenticatorCache[namespace];
    }
}

interface IHash {
    [details: string]: Authenticator;
}

const authenticatorCache: IHash = {};

export = Authenticator;
