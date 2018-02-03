
(function () {

    var SUCCESS = 'success';
    var ERROR = 'danger';
    var INFO = 'info';

    oneClickAppsRepository["redis"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var REDIS_PASSWORD = 'REDIS_PASSWORD';
        var CONTAINER_NAME = 'CONTAINER_NAME';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'Container Name',
            id: CONTAINER_NAME,
            type: 'text'
        });
        step1next.data.push({
            label: 'OPTIONAL: Redis password',
            id: REDIS_PASSWORD,
            type: 'text'
        });

        step1next.process = function (data, step1Callback) {

            // create container and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {

                var nodejsCode = 'const client = redis.createClient(6379, "srv-captain--' + data[CONTAINER_NAME] + ')';
                if (data[REDIS_PASSWORD]) {
                    nodejsCode = 'const client = redis.createClient(6379, "srv-captain--' + data[CONTAINER_NAME] + ', {password: "' + data[REDIS_PASSWORD] + '"})';
                }

                step1Callback({
                    message: {
                        text: 'Redis is deployed and available as srv-captain--' + data[CONTAINER_NAME]
                            + ':6379 to other apps. For example with NodeJS: ' + nodejsCode,
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


            if (!data[CONTAINER_NAME]) {
                errorMessage = 'Container name is required!';
            }

            if (errorMessage) {
                endWithError(errorMessage);
                return;
            }

            var appName = data[CONTAINER_NAME];
            var envVars = [];
            var volumes = [{
                volumeName: appName + '-redis-data',
                containerPath: '/data'
            }];

            if (data[REDIS_PASSWORD]) {
                envVars.push({
                    key: REDIS_PASSWORD,
                    value: data[REDIS_PASSWORD]
                });
            }

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
                        "FROM redis:latest"
                    ]
                }

                if (data[REDIS_PASSWORD]) {
                    captainDefinitionContent.dockerfileLines.push('CMD exec redis-server --requirepass \"$REDIS_PASSWORD\"');
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
            text: 'Redis is an open source key-value store that functions as a data structure server.' +
                '\n\n After installation on CaptainDuckDuck, it will be available as srv-captain--YOUR_CONTAINER_NAME at port 6379 to other CaptainDuckDuck apps.' +
                '\n\n Enter your Redis container name and click on next. It will take about a minute for the process to finish.'
        }
        step1.next = step1next;
        return step1;

    }

})();
