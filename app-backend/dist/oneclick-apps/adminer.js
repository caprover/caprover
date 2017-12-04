
(function () {

    var SUCCESS = 'success';
    var ERROR = 'danger';
    var INFO = 'info';

    oneClickAppsRepository["adminer"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var ADMINER_DESIGN = 'ADMINER_DESIGN';
        var ADMINER_PLUGINS = 'ADMINER_PLUGINS';

        var CONTAINER_NAME = 'CONTAINER_NAME';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'Container Name',
            id: CONTAINER_NAME,
            type: 'text'
        });
        step1next.data.push({
            label: 'OPTINAL: Adminer design',
            id: ADMINER_DESIGN,
            type: 'text'
        });
        step1next.data.push({
            label: 'OPTINAL: Adminer plugins (space separated)',
            id: ADMINER_PLUGINS,
            type: 'text'
        });

        step1next.process = function (data, step1Callback) {

            // create container and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {

                step1Callback({
                    message: {
                        text: 'Adminer is deployed and available as http://srv-captain--' + data[CONTAINER_NAME]
                            + ' to other apps.',
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
                key: ADMINER_PLUGINS,
                value: data[ADMINER_PLUGINS]
            }, {
                key: ADMINER_DESIGN,
                value: data[ADMINER_DESIGN]
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
                        "FROM adminer:4.3",
                        'USER	root',
                        'CMD	[ "php", "-S", "[::]:80", "-t", "/var/www/html" ]',
                        'EXPOSE 80'
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
            text: 'Adminer (formerly phpMinAdmin) is a full-featured database management tool written in PHP. Conversely to phpMyAdmin, it consist of a single file ready to deploy to the target server. Adminer is available for MySQL, PostgreSQL, SQLite, MS SQL, Oracle, Firebird, SimpleDB, Elasticsearch and MongoDB. ' +
                'Enter your Adminer Configuration parameters and click on next. It will take about a minute for the process to finish.'
        }
        step1.next = step1next;
        return step1;

    }

})();