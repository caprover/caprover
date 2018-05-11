
(function () {

    var SUCCESS = 'success';
    var ERROR = 'danger';
    var INFO = 'info';

    oneClickAppsRepository["wordpress"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var WORDPRESS_NAME = 'WORDPRESS_NAME';
        var MYSQL_ROOT_PASSWORD = 'MYSQL_ROOT_PASSWORD';
        var DOCKER_TAG_WORDPRESS = 'DOCKER_TAG_WORDPRESS';
        var DOCKER_TAG_MYSQL = 'DOCKER_TAG_MYSQL';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'WordPress Name',
            id: WORDPRESS_NAME,
            type: 'text'
        });
        step1next.data.push({
            label: 'Choose a MySQL Root Password',
            id: MYSQL_ROOT_PASSWORD,
            type: 'text'
        });
        step1next.data.push({
            label: 'OPTIONAL: Docker Tag for WordPress (default "4.9")',
            labelDesc: 'https://hub.docker.com/r/library/wordpress/tags/',
            id: DOCKER_TAG_WORDPRESS,
            type: 'text'
        });
        step1next.data.push({
            label: 'OPTIONAL: Docker Tag for MySQL (default "5.5")',
            labelDesc: 'https://hub.docker.com/r/library/mysql/tags/',
            id: DOCKER_TAG_MYSQL,
            type: 'text'
        });

        step1next.process = function (data, step1Callback) {

            // create containers and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {
                step1Callback({
                    message: {
                        text: 'Wordpress is deployed and available as ' + data[WORDPRESS_NAME] +
                            '\n\n IMPORTANT: It will take up to 2 minutes for wordpress to be ready. Before that, you might see 502 error page.\n ',
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

            if (!data[MYSQL_ROOT_PASSWORD]) {
                errorMessage = 'Root password is required!';
            } else if (!data[WORDPRESS_NAME]) {
                errorMessage = 'Container name is required!';
            }

            if (errorMessage) {
                endWithError(errorMessage);
                return;
            }

            var dockerTagWordPress = data[DOCKER_TAG_WORDPRESS] || '4.9';
            var dockerTagMySql = data[DOCKER_TAG_MYSQL] || '5.5';
            var mySqlAppName = data[WORDPRESS_NAME] + '-mysql';
            var envVarsMySql = [{
                key: MYSQL_ROOT_PASSWORD,
                value: data[MYSQL_ROOT_PASSWORD]
            }];
            var volumesMySql = [{
                volumeName: mySqlAppName + '-vol',
                containerPath: '/var/lib/mysql'
            }];

            function createMySqlContainer() {

                var hasPersistentData = true;

                apiManager.registerNewApp(mySqlAppName, hasPersistentData, function (data) {
                    if (getErrorMessageIfExists(data)) {
                        endWithError(getErrorMessageIfExists(data));
                        return;
                    }

                    setupMySqlAppDefinition();
                });
            }

            function setupMySqlAppDefinition() {

                var appDefinitionMySql = {
                    instanceCount: 1,
                    envVars: envVarsMySql,
                    notExposeAsWebApp: true,
                    volumes: volumesMySql
                };

                apiManager.updateConfigAndSave(mySqlAppName, appDefinitionMySql, function (data) {
                    if (getErrorMessageIfExists(data)) {
                        endWithError(getErrorMessageIfExists(data));
                        return;
                    }

                    deployMySqlDockerfile();
                });
            }

            function deployMySqlDockerfile() {

                var captainDefinitionContent = {
                    schemaVersion: 1,
                    dockerfileLines: [
                        "FROM mysql:" + dockerTagMySql
                    ]
                }

                apiManager.uploadCaptainDefinitionContent(mySqlAppName,
                    JSON.stringify(captainDefinitionContent), function (data) {
                        if (getErrorMessageIfExists(data)) {
                            endWithError(getErrorMessageIfExists(data));
                            return;
                        }

                        createWordPressContainer();

                    })
            }

            var wordPressContainerName = data[WORDPRESS_NAME];
            var envVarsWordPress = [{
                key: 'WORDPRESS_DB_PASSWORD',
                value: data[MYSQL_ROOT_PASSWORD]
            }, {
                key: 'WORDPRESS_DB_HOST',
                value: 'srv-captain--' + mySqlAppName + ':3306'
            }];
            var volumesWordPress = [{
                volumeName: wordPressContainerName + '-vol',
                containerPath: '/var/www/html'
            }];

            function createWordPressContainer() {

                var hasPersistentData = true;

                apiManager.registerNewApp(wordPressContainerName, hasPersistentData, function (data) {
                    if (getErrorMessageIfExists(data)) {
                        endWithError(getErrorMessageIfExists(data));
                        return;
                    }

                    setupWordPressAppDefinition();
                });
            }

            function setupWordPressAppDefinition() {

                var appDefinitionWordpress = {
                    instanceCount: 1,
                    envVars: envVarsWordPress,
                    notExposeAsWebApp: false,
                    volumes: volumesWordPress
                };

                apiManager.updateConfigAndSave(wordPressContainerName, appDefinitionWordpress, function (data) {
                    if (getErrorMessageIfExists(data)) {
                        endWithError(getErrorMessageIfExists(data));
                        return;
                    }

                    deployWordPressDockerfile();
                });
            }

            function deployWordPressDockerfile() {

                var captainDefinitionContent = {
                    schemaVersion: 1,
                    dockerfileLines: [
                        "FROM wordpress:" + dockerTagWordPress
                    ]
                }

                apiManager.uploadCaptainDefinitionContent(wordPressContainerName,
                    JSON.stringify(captainDefinitionContent), function (data) {
                        if (getErrorMessageIfExists(data)) {
                            endWithError(getErrorMessageIfExists(data));
                            return;
                        }

                        endWithSuccess();

                    })
            }

            createMySqlContainer();

        }

        var step1 = {};
        step1.message = {
            type: INFO,
            text: 'WordPress is an online, open source website creation tool written in PHP. But in non-geek speak, it’s probably the easiest and most powerful blogging and website content management system (or CMS) in existence today.' +
                '\n\n Enter your WordPress Configuration parameters and click on next. A MySQL (database) and a WordPress container will be created for you. ' +
                ' The process will take about a minute for the process to finish.'
        }
        step1.next = step1next;
        return step1;

    }

})();