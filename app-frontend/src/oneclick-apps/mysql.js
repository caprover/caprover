
(function () {

    var SUCCESS = 'success';
    var ERROR = 'danger';
    var INFO = 'info';

    oneClickAppsRepository["mysql"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var MYSQL_CONTAINER_NAME = 'MYSQL_CONTAINER_NAME';
        var MYSQL_ROOT_PASSWORD = 'MYSQL_ROOT_PASSWORD';
        var DOCKER_TAG = 'DOCKER_TAG';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'MySQL Container Name',
            id: MYSQL_CONTAINER_NAME,
            type: 'text'
        });

        step1next.data.push({
            label: 'OPTIONAL: Docker Tag (default "5.5")',
            labelDesc: 'https://hub.docker.com/r/library/mysql/tags/',
            id: DOCKER_TAG,
            type: 'text'
        });

        step1next.data.push({
            label: 'MySQL Root Password',
            id: MYSQL_ROOT_PASSWORD,
            type: 'text'
        });

        step1next.process = function (data, step1Callback) {

            // create MYSQL_CONTAINER_NAME and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {
                step1Callback({
                    message: {
                        text: 'MySQL is deployed and available as srv-captain--' + data[MYSQL_CONTAINER_NAME]
                            + ':3306 to other apps. For example with NodeJS, you do "var con = mysql.createConnection({ host: "srv-captain--'
                            + data[MYSQL_CONTAINER_NAME] + '", user: "root", password: "*********" });"',
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
            } else if (!data[MYSQL_CONTAINER_NAME]) {
                errorMessage = 'Container name is required!';
            }

            if (errorMessage) {
                endWithError(errorMessage);
                return;
            }

            var appName = data[MYSQL_CONTAINER_NAME];
            var dockerTag = data[DOCKER_TAG] || '5.5';
            var envVars = [{
                key: MYSQL_ROOT_PASSWORD,
                value: data[MYSQL_ROOT_PASSWORD]
            }];
            var volumes = [{
                volumeName: appName + '-mysql-vol',
                containerPath: '/var/lib/mysql'
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
                        "FROM mysql:" + dockerTag
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
            text: 'MySQL is the world\'s most popular open source database. With its proven performance, reliability and ease-of-use, MySQL has become the leading database choice for web-based applications, covering the entire range from personal projects and websites, via e-commerce and information services, all the way to high profile web properties including Facebook, Twitter, YouTube, Yahoo! and many more.' +
                '\n\n After installation on CaptainDuckDuck, it will be available as srv-captain--YOUR_CONTAINER_NAME at port 3306 to other CaptainDuckDuck apps.' +
                '\n\nEnter your MySQL Configuration parameters and click on next. It will take about a minute for the process to finish.'
        }
        step1.next = step1next;
        return step1;

    }

})();