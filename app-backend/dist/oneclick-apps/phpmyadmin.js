
(function () {

    var SUCCESS = 'success';
    var ERROR = 'danger';
    var INFO = 'info';

    oneClickAppsRepository["phpmyadmin"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var CONTAINER_NAME = 'CONTAINER_NAME';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'Container Name',
            id: CONTAINER_NAME,
            type: 'text'
        });

        step1next.process = function (data, step1Callback) {

            // create container and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {

                step1Callback({
                    message: {
                        text: 'PhpMyAdmin is deployed and available as ' + data[CONTAINER_NAME],
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
            var envVars = [{
                key: "PMA_ARBITRARY",
                value: "1"
            }];
            var volumes = [];

            function createContainer() {

                var hasPersistentData = false;

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
                    notExposeAsWebApp: false,
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
                        "FROM phpmyadmin/phpmyadmin"
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
            text: 'PhpMyAdmin is the most popular web interface for MySQL & MariaDB. Simply install PhpMyAdmin and then select what database you want to connect to.' +
                '\n\n Enter your PhpMyAdmin Configuration parameters and click on next. It will take about a minute for the process to finish.'
        }
        step1.next = step1next;
        return step1;

    }

})();