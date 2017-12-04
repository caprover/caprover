
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

    oneClickAppsRepository["mongo-express"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var ME_CONFIG_MONGODB_SERVER = 'ME_CONFIG_MONGODB_SERVER';
        var ME_CONFIG_MONGODB_ADMINUSERNAME = 'ME_CONFIG_MONGODB_ADMINUSERNAME';
        var ME_CONFIG_MONGODB_ADMINPASSWORD = 'ME_CONFIG_MONGODB_ADMINPASSWORD';

        var ME_CONFIG_MONGODB_PORT = 'ME_CONFIG_MONGODB_PORT';

        var ME_CONFIG_BASICAUTH_USERNAME = 'ME_CONFIG_BASICAUTH_USERNAME';
        var ME_CONFIG_BASICAUTH_PASSWORD = 'ME_CONFIG_BASICAUTH_PASSWORD';

        var CONTAINER_NAME = 'CONTAINER_NAME';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'Container Name',
            id: CONTAINER_NAME,
            type: 'text'
        });

        step1next.data.push({
            label: 'MongoDB Server Address.',
            labelDesc: 'If MongoDB is created by CaptainDuckDuck, use srv-captain--REPLACE_THIS_WITH_CONTAINER_NAME.',
            id: ME_CONFIG_MONGODB_SERVER,
            type: 'text'
        });

        step1next.data.push({
            label: 'OPTIONAL: MongoDB Server Port (defaults to 27017)',
            id: ME_CONFIG_MONGODB_PORT,
            type: 'text'
        });

        step1next.data.push({
            label: 'MongoDB Admin Username',
            id: ME_CONFIG_MONGODB_ADMINUSERNAME,
            type: 'text'
        });
        step1next.data.push({
            label: 'MongoDB Admin Password',
            id: ME_CONFIG_MONGODB_ADMINPASSWORD,
            type: 'text'
        });

        step1next.data.push({
            label: 'Mongo-Express Dashboard Username',
            id: ME_CONFIG_BASICAUTH_USERNAME,
            type: 'text'
        });
        step1next.data.push({
            label: 'Mongo-Express Dashboard Password',
            id: ME_CONFIG_BASICAUTH_PASSWORD,
            type: 'text'
        });

        step1next.process = function (data, step1Callback) {

            // create container and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {

                step1Callback({
                    message: {
                        text: 'MongoExpress is deployed and available as ' + data[CONTAINER_NAME],
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

            if (!data[ME_CONFIG_MONGODB_PORT]) {
                data[ME_CONFIG_MONGODB_PORT] = 27017;
            }

            if (!data[CONTAINER_NAME]) {
                errorMessage = 'Container name is required!';
            } else if (!data[ME_CONFIG_MONGODB_SERVER]) {
                errorMessage = 'Server name is required!';
            } else if (!data[ME_CONFIG_MONGODB_ADMINUSERNAME]) {
                errorMessage = 'MongoDB Admin Username is required!';
            } else if (!data[ME_CONFIG_MONGODB_ADMINPASSWORD]) {
                errorMessage = 'MongoDB Admin Password is required!';
            } else if (!data[ME_CONFIG_MONGODB_PORT]) {
                errorMessage = 'MongoDB port is required!';
            } else if (!data[ME_CONFIG_BASICAUTH_USERNAME]) {
                errorMessage = 'Mongo-Express dashboard username is required!';
            } else if (!data[ME_CONFIG_BASICAUTH_PASSWORD]) {
                errorMessage = 'Mongo-Express dashboard password is required!';
            }

            if (errorMessage) {
                endWithError(errorMessage);
                return;
            }

            var appName = data[CONTAINER_NAME];
            var envVars = [{
                key: ME_CONFIG_MONGODB_SERVER,
                value: data[ME_CONFIG_MONGODB_SERVER]
            }, {
                key: ME_CONFIG_MONGODB_ADMINUSERNAME,
                value: data[ME_CONFIG_MONGODB_ADMINUSERNAME]
            }, {
                key: ME_CONFIG_MONGODB_ADMINPASSWORD,
                value: data[ME_CONFIG_MONGODB_ADMINPASSWORD]
            }, {
                key: ME_CONFIG_MONGODB_PORT,
                value: data[ME_CONFIG_MONGODB_PORT]
            }, {
                key: ME_CONFIG_BASICAUTH_USERNAME,
                value: data[ME_CONFIG_BASICAUTH_USERNAME]
            }, {
                key: ME_CONFIG_BASICAUTH_PASSWORD,
                value: data[ME_CONFIG_BASICAUTH_PASSWORD]
            }, {
                key: "ME_CONFIG_SITE_COOKIESECRET",
                value: 'cookiesecret' + uuidv4()
            }, {
                key: "ME_CONFIG_SITE_SESSIONSECRET",
                value: 'sessionsecret' + uuidv4()
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
                        "FROM mongo-express",
                        'ENV VCAP_APP_PORT=80',
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
            text: 'MongoExpress is a Web-based MongoDB admin interface, written with Node.js and express. ' +
                ' See MongoExpress page for more details: https://github.com/mongo-express/mongo-express' +
                '\n\n Enter your MongoExpress Configuration parameters and click on next. It will take about a minute for the process to finish.'
        }
        step1.next = step1next;
        return step1;

    }

})();