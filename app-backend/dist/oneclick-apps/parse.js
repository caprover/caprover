
(function () {
    
        var SUCCESS = 'success';
        var ERROR = 'danger';
        var INFO = 'info';
    
        function uuidv4() {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    
        oneClickAppsRepository["parse"] = function (apiManager) {
    
            var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;
    
            var PARSE_NAME = 'PARSE_NAME';
            var MONGODB_ROOT_PASSWORD = 'MONGODB_ROOT_PASSWORD';
            var PARSE_SERVER_APPLICATION_ID = 'PARSE_SERVER_APPLICATION_ID';
            var PARSE_SERVER_MASTER_KEY = 'PARSE_SERVER_MASTER_KEY';
    
            var step1next = {};
    
            step1next.data = [];
            step1next.data.push({
                label: 'Parser Server Name',
                id: PARSE_NAME,
                type: 'text'
            });
            step1next.data.push({
                label: 'OPTINAL: Choose a MongoDB Root Password - or leave empty for randomly generated value',
                id: MONGODB_ROOT_PASSWORD,
                type: 'text'
            });
            step1next.data.push({
                label: 'OPTINAL: Choose an Application ID - or leave empty for randomly generated value',
                id: PARSE_SERVER_APPLICATION_ID,
                type: 'text'
            });
            step1next.data.push({
                label: 'OPTINAL: Choose a Master Key - or leave empty for randomly generated value',
                id: PARSE_SERVER_MASTER_KEY,
                type: 'text'
            });
    
            step1next.process = function (data, step1Callback) {
    
                // create containers and set persistent
                // set env vars and volumes
                // deploy image via dockerfile
    
                function endWithSuccess() {
                    step1Callback({
                        message: {
                            text: 'Parse is deployed and available as ' + data[PARSE_NAME],
                            type: SUCCESS
                        },
                        next: null // this can be similar to step1next, in that case the flow continues...
                    });
                }
    
                function endWithError(errorMessage) {
                    step1Callback({
                        message: {
                            text: errorMessage,
                            type: ERROR
                        },
                        next: step1next
                    });
                }
    
                // process the inputs:
    
                var errorMessage = null;
    
                data[MONGODB_ROOT_PASSWORD] = data[MONGODB_ROOT_PASSWORD] || uuidv4();
                data[PARSE_SERVER_APPLICATION_ID] = data[PARSE_SERVER_APPLICATION_ID] || uuidv4();
                data[PARSE_SERVER_MASTER_KEY] = data[PARSE_SERVER_MASTER_KEY] || uuidv4();
    
    
                if (!data[PARSE_NAME]) {
                    errorMessage = 'Container name is required!';
                }
    
                if (errorMessage) {
                    endWithError(errorMessage);
                    return;
                }
    
                var appName = data[PARSE_NAME];
                var mongoDbContainerName = data[PARSE_NAME] + '-mongodb';
    
                var envVarsMongo = [{
                    key: 'MONGO_INITDB_ROOT_USERNAME',
                    value: 'root'
                }, {
                    key: 'MONGO_INITDB_ROOT_PASSWORD',
                    value: data[MONGODB_ROOT_PASSWORD]
                }];
    
                var volumesMongoDb = [{
                    volumeName: appName + '-mongo-db-vol',
                    containerPath: '/data/db'
                }, {
                    volumeName: appName + '-mongo-cfg-vol',
                    containerPath: '/data/configdb'
                }];
    
                function createMongoDbContainer() {
    
                    var hasPersistentData = true;
    
                    apiManager.registerNewApp(mongoDbContainerName, hasPersistentData, function (data) {
                        if (getErrorMessageIfExists(data)) {
                            endWithError(getErrorMessageIfExists(data));
                            return;
                        }
    
                        setupMongoDbAppDefinition();
                    });
                }
    
                function setupMongoDbAppDefinition() {
                    apiManager.updateConfigAndSave(mongoDbContainerName, 1, envVarsMongo, true, volumesMongoDb, function (data) {
                        if (getErrorMessageIfExists(data)) {
                            endWithError(getErrorMessageIfExists(data));
                            return;
                        }
    
                        deployMongoDbDockerfile();
                    });
                }
    
                function deployMongoDbDockerfile() {
    
                    var captainDefinitionContent = {
                        schemaVersion: 1,
                        dockerfileLines: [
                            "FROM mongo:latest"
                        ]
                    }
    
                    apiManager.uploadCaptainDefinitionContent(mongoDbContainerName,
                        JSON.stringify(captainDefinitionContent), function (data) {
                            if (getErrorMessageIfExists(data)) {
                                endWithError(getErrorMessageIfExists(data));
                                return;
                            }
    
                            createParseContainer();
    
                        })
                }
    
                var envVarParse = [{
                    key: 'PORT',
                    value: 80
                }, {
                    key: PARSE_SERVER_APPLICATION_ID,
                    value: data[PARSE_SERVER_APPLICATION_ID]
                }, {
                    key: PARSE_SERVER_MASTER_KEY,
                    value: data[PARSE_SERVER_MASTER_KEY]
                }, {
                    key: 'PARSE_SERVER_DATABASE_URI',
                    value: 'mongodb://root:'
                        + encodeURIComponent(data[MONGODB_ROOT_PASSWORD])
                        + '@srv-captain--' + mongoDbContainerName + ':27017/parse?authSource=admin'
                }];
                var volumesParse = [];
    
                function createParseContainer() {
    
                    var hasPersistentData = false;
    
                    apiManager.registerNewApp(appName, hasPersistentData, function (data) {
                        if (getErrorMessageIfExists(data)) {
                            endWithError(getErrorMessageIfExists(data));
                            return;
                        }
    
                        setupParseAppDefinition();
                    });
                }
    
                function setupParseAppDefinition() {
                    apiManager.updateConfigAndSave(appName, 1, envVarParse, false, volumesParse, function (data) {
                        if (getErrorMessageIfExists(data)) {
                            endWithError(getErrorMessageIfExists(data));
                            return;
                        }
    
                        deployParseDockerfile();
                    });
                }
    
                function deployParseDockerfile() {
    
                    var captainDefinitionContent = {
                        schemaVersion: 1,
                        dockerfileLines: [
                            "FROM parseplatform/parse-server:latest"
                        ]
                    }
    
                    apiManager.uploadCaptainDefinitionContent(appName,
                        JSON.stringify(captainDefinitionContent), function (data) {
                            if (getErrorMessageIfExists(data)) {
                                endWithError(getErrorMessageIfExists(data));
                                return;
                            }
    
                            endWithSuccess();
    
                        })
                }
    
                createMongoDbContainer();
    
            }
    
            var step1 = {};
            step1.message = {
                type: INFO,
                text: 'Parse Server is an open source version of the Parse backend that can be deployed to any infrastructure that can run Node.js.' +
                    ' For more information on Parse platform see http://parseplatform.org/' +
                    ' Enter your Parse Configuration parameters and click on next. A MongoDB (database) and a Parse container will be created for you. ' +
                    ' The process will take about a minute for the process to finish.'
            }
            step1.next = step1next;
            return step1;
    
        }
    
    })();