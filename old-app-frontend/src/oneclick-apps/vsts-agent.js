
(function () {

    var SUCCESS = 'success';
    var ERROR = 'danger';
    var INFO = 'info';

    oneClickAppsRepository["vsts-agent"] = function (apiManager) {

        var getErrorMessageIfExists = apiManager.getErrorMessageIfExists;

        var VSTS_ACCOUNT = 'VSTS_ACCOUNT';
        var VSTS_TOKEN = 'VSTS_TOKEN';
        var VSTS_AGENT = 'VSTS_AGENT';
        var VSTS_POOL = 'VSTS_POOL';
        var DOCKER_TAG = 'DOCKER_TAG';
        var VSTS_AGENT_CONTAINER_NAME = 'VSTS_AGENT_CONTAINER_NAME';

        var step1next = {};

        step1next.data = [];
        step1next.data.push({
            label: 'VSTS Agent Container Name',
            id: VSTS_AGENT_CONTAINER_NAME,
            type: 'text'
        });

        step1next.data.push({
            label: 'OPTIONAL: Docker Tag (default "latest")',
            labelDesc: 'https://hub.docker.com/r/microsoft/vsts-agent/tags/',
            id: DOCKER_TAG,
            type: 'text'
        });

        step1next.data.push({
            label: 'VSTS Account',
            labelDesc: 'The name of the Visual Studio account. Take only the account part from your address, e.g. http://{account}.visualstudio.com',
            id: VSTS_ACCOUNT,
            type: 'text'
        });
        step1next.data.push({
            label: 'VSTS Token',
            labelDesc: 'A personal access token (PAT) for the Visual Studio account that has been given at least the Agent Pools (read, manage) scope.',
            id: VSTS_TOKEN,
            type: 'text'
        });

        step1next.data.push({
            label: 'VSTS Agent',
            labelDesc: 'The name of the agent.',
            id: VSTS_AGENT,
            type: 'text'
        });

        step1next.data.push({
            label: 'VSTS Pool',
            labelDesc: 'The name of the agent pool.',
            id: VSTS_POOL,
            type: 'text'
        });

        step1next.process = function (data, step1Callback) {

            // create container and set persistent
            // set env vars and volumes
            // deploy image via dockerfile

            function endWithSuccess() {
                step1Callback({
                    message: {
                        text: 'VSTS Agent is deployed and published as ' + data[VSTS_AGENT] +'.',
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

            if (!data[VSTS_AGENT_CONTAINER_NAME]) {
                errorMessage = 'Container name is required!';
            } else if (!data[VSTS_ACCOUNT]) {
                errorMessage = 'Account is required!';
            } else if (!data[VSTS_TOKEN]) {
                errorMessage = 'Acess token is required!';
            } else if (!data[VSTS_AGENT]) {
                errorMessage = 'Agent name is required!';
            } else if (!data[VSTS_POOL]) {
                errorMessage = 'Pool name is required!';
            }

            if (errorMessage) {
                endWithError(errorMessage);
                return;
            }

            var appName = data[VSTS_AGENT_CONTAINER_NAME];
            var dockerTag = data[DOCKER_TAG] || 'latest';
            var envVars = [{
                key: VSTS_ACCOUNT,
                value: data[VSTS_ACCOUNT]
            }, {
                key: VSTS_TOKEN,
                value: data[VSTS_TOKEN]
            },
            {
                key: VSTS_AGENT,
                value: data[VSTS_AGENT]
            },
            {
                key: VSTS_POOL,
                value: data[VSTS_POOL]
            }];
            var volumes = [{
                volumeName: appName + '-vsts-agent-vol',
                containerPath: '/data/db'
            }, {
                volumeName: appName + '-vsts-agent-vol',
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
                        "FROM microsoft/vsts-agent:" + dockerTag
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
            text: 'Official image for the Visual Studio Team Services (VSTS) agent.'
        }
        step1.next = step1next;
        return step1;

    }

})();
