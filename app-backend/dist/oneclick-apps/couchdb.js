
(function () {

    var SUCCESS = 'success';
    var ERROR = 'danger';
    var INFO = 'info';

    oneClickAppsRepository["couchdb"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var COUCHDB_CONTAINER_NAME = 'COUCHDB_CONTAINER_NAME';
        var DOCKER_TAG = 'DOCKER_TAG';
        var COUCHDB_PASSWORD = 'COUCHDB_PASSWORD';
        var COUCHDB_USER = 'COUCHDB_USER';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'Container Name',
            id: COUCHDB_CONTAINER_NAME,
            type: 'text'
        });
        step1next.data.push({
            label: 'OPTIONAL: Docker Tag (default "2")',
            labelDesc: 'https://hub.docker.com/r/library/couchdb/tags/',
            id: DOCKER_TAG,
            type: 'text'
        });
        step1next.data.push({
            label: 'Username',
            id: COUCHDB_USER,
            type: 'text'
        });
        step1next.data.push({
            label: 'Password',
            id: COUCHDB_PASSWORD,
            type: 'text'
        });

        step1next.process = function (data, step1Callback) {

            // create COUCHDB_CONTAINER_NAME and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {
                step1Callback({
                    message: {
                        text: 'CouchDB is deployed and available as srv-captain--' + data[COUCHDB_CONTAINER_NAME]
                            + ' at port 5984 to other apps.',
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

            if (!data[COUCHDB_PASSWORD]) {
                errorMessage = 'password is required!';
            } else if (!data[COUCHDB_USER]) {
                errorMessage = 'Username is required!';
            } else if (!data[COUCHDB_CONTAINER_NAME]) {
                errorMessage = 'Container name is required!';
            }

            if (errorMessage) {
                endWithError(errorMessage);
                return;
            }

            var appName = data[COUCHDB_CONTAINER_NAME];
            var dockerTag = data[DOCKER_TAG] || '2';
            var envVars = [{
                key: COUCHDB_PASSWORD,
                value: data[COUCHDB_PASSWORD]
            }, {
                key: COUCHDB_USER,
                value: data[COUCHDB_USER]
            }];
            var volumes = [{
                volumeName: appName + '-data',
                containerPath: '/opt/couchdb/data'
            }, {
                volumeName: appName + '-config',
                containerPath: '/opt/couchdb/etc'
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
                        "FROM couchdb:" + dockerTag
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

            createContainer();

        }

        var step1 = {};
        step1.message = {
            type: INFO,
            text: 'CouchDB is a database that uses JSON for documents, an HTTP API, & JavaScript/declarative indexing.' +
                '\n\n After installation on CaptainDuckDuck, it will be available as srv-captain--YOUR_CONTAINER_NAME at port 5984 to other CaptainDuckDuck apps.' +
                '\n\nEnter your CouchDB Configuration parameters and click on next. It will take about a minute for the process to finish.'
        }
        step1.next = step1next;
        return step1;

    }

})();