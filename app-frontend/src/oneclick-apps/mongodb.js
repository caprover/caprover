
(function () {

    var SUCCESS = 'success';
    var ERROR = 'danger';
    var INFO = 'info';

    oneClickAppsRepository["mongodb"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var MONGO_INITDB_ROOT_USERNAME = 'MONGO_INITDB_ROOT_USERNAME';
        var MONGO_INITDB_ROOT_PASSWORD = 'MONGO_INITDB_ROOT_PASSWORD';
        var MONGO_CONTAINER_NAME = 'MONGO_CONTAINER_NAME';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'MongoDB Container Name',
            id: MONGO_CONTAINER_NAME,
            type: 'text'
        });
        step1next.data.push({
            label: 'MongoDB Root Username',
            id: MONGO_INITDB_ROOT_USERNAME,
            type: 'text'
        });
        step1next.data.push({
            label: 'MongoDB Root Password',
            id: MONGO_INITDB_ROOT_PASSWORD,
            type: 'text'
        });

        step1next.process = function (data, step1Callback) {

            // create container and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {
                step1Callback({
                    message: {
                        text: 'MongoDB is deployed and available as srv-captain--' + data[MONGO_CONTAINER_NAME]
                            + ':27017 to other apps. For example with NodeJS: mongoose.connect("mongodb://srv-captain--'
                            + data[MONGO_CONTAINER_NAME] + '/mydatabase", { useMongoClient: true });',
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

            if (!data[MONGO_CONTAINER_NAME]) {
                errorMessage = 'Container name is required!';
            } else if (!data[MONGO_INITDB_ROOT_USERNAME]) {
                errorMessage = 'Root username is required!';
            } else if (!data[MONGO_INITDB_ROOT_PASSWORD]) {
                errorMessage = 'Root password is required!';
            }

            if (errorMessage) {
                endWithError(errorMessage);
                return;
            }

            var appName = data[MONGO_CONTAINER_NAME];
            var envVars = [{
                key: MONGO_INITDB_ROOT_USERNAME,
                value: data[MONGO_INITDB_ROOT_USERNAME]
            }, {
                key: MONGO_INITDB_ROOT_PASSWORD,
                value: data[MONGO_INITDB_ROOT_PASSWORD]
            }];
            var volumes = [{
                volumeName: appName + '-mongo-db-vol',
                containerPath: '/data/db'
            }, {
                volumeName: appName + '-mongo-cfg-vol',
                containerPath: '/data/configdb'
            }];

            function createContainer() {

                var hasPersistentData = true;

                apiManager.registerNewApp(appName, hasPersistentData, function (data) {
                    if (getErrorMessageIfExists(data)) {
                        endWithError(getErrorMessageIfExists(data));
                        return;
                    }

                    setupAppDefinition();
                });
            }

            function setupAppDefinition() {

                var appDefinition = {
                    instanceCount: 1,
                    envVars: envVars,
                    notExposeAsWebApp: true,
                    volumes: volumes
                };

                apiManager.updateConfigAndSave(appName, appDefinition, function (data) {
                    if (getErrorMessageIfExists(data)) {
                        endWithError(getErrorMessageIfExists(data));
                        return;
                    }

                    deployDockerfile();
                });
            }

            function deployDockerfile() {

                var captainDefinitionContent = {
                    schemaVersion: 1,
                    dockerfileLines: [
                        "FROM mongo:latest"
                    ]
                }

                apiManager.uploadCaptainDefinitionContent(appName,
                    JSON.stringify(captainDefinitionContent), function (data) {
                        if (getErrorMessageIfExists(data)) {
                            endWithError(getErrorMessageIfExists(data));
                            return;
                        }

                        endWithSuccess();
                    });
            }

            createContainer();

        }

        var step1 = {};
        step1.message = {
            type: INFO,
            text: 'Enter your MongoDB Configuration parameters and click on next. It will take about a minute for the process to finish.'
        }
        step1.next = step1next;
        return step1;

    }

})();