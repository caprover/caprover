
(function () {

    var SUCCESS = 'success';
    var ERROR = 'danger';
    var INFO = 'info';

    oneClickAppsRepository["thumbor"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var CONTAINER_NAME = 'CONTAINER_NAME';
        var DOCKER_TAG = 'DOCKER_TAG';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'thumbor Container Name',
            id: CONTAINER_NAME,
            type: 'text'
        });

        step1next.data.push({
            label: 'OPTIONAL: Docker Tag (default "6.4.2")',
            labelDesc: 'https://hub.docker.com/r/apsl/thumbor/tags/',
            id: DOCKER_TAG,
            type: 'text'
        });


        step1next.process = function (data, step1Callback) {

            // create container and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {
                step1Callback({
                    message: {
                        text: 'thumbor is deployed and available as ' + data[CONTAINER_NAME] +
                            '. Go to YOUR_APP_URL/unsafe/200x50/i.imgur.com/bvjzPct.jpg to test thumbor!',
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
            var dockerTag = data[DOCKER_TAG] || '6.4.2';
            var envVars = [{
                key: 'THUMBOR_PORT',
                value: 80
            }];
            var volumes = [{
                volumeName: appName + '-thumbor-vol',
                containerPath: '/data'
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
                        "FROM apsl/thumbor:" + dockerTag,
                        "EXPOSE 80"
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
            text: 'thumbor is a smart imaging service. It enables on-demand crop, resizing and flipping of images. It also features a VERY smart detection of important points in the image for better cropping and resizing, using state-of-the-art face and feature detection algorithms (more on that in Detection Algorithms). Using thumbor is very easy (after it is running). All you have to do is access it using an URL for an image, like this:' +
                '\n http://<thumbor-server>/300x200/smart/s.glbimg.com/et/bb/f/original/2011/03/24/VN0JiwzmOw0b0lg.jpg' +
                '\n\n See http://thumbor.org for more details. ' +
                '\n\n Enter your thumbor Configuration parameters and click on next. It will take about a minute for the process to finish.'
        }
        step1.next = step1next;
        return step1;

    }

})();