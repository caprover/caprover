angular.module('RDash')
    .controller('AppDetailsCtrl', ['$scope', 'apiManager', 'captainToast',
        '$uibModal', '$state', '$location', '$interval', '$stateParams', AppDetailsCtrl]);

function AppDetailsCtrl($scope,
                        apiManager, captainToast, $uibModal, $state, $location, $interval, $stateParams) {
    $scope.rootDomainWithProtocol = '';
    $scope.loadingState = {};
    $scope.loadingState.enabled = true;
    $scope.editContext = {
        appToEdit: undefined
    }

    apiManager.getAllApps(function (data) {
        $scope.loadingState.enabled = false;
        if (captainToast.showErrorToastIfNeeded(data)) {
            return;
        }

        const allApps = data.data;

        for (var i = 0; i < data.data.length; i++) {

            var app = data.data[i];

            for (var j = 0; j < app.versions.length; j++) {
                if (app.versions[j].version === app.deployedVersion) {
                    app.deployedGitHash = app.versions[j].gitHash || 'n/a';
                    app.deployedTimeStamp = new Date(app.versions[j].timeStamp).toLocaleString();
                    break;
                }
            }
        }

        const appNameInRoute = $stateParams.appName;
        const appToEdit = allApps.find(app => app.appName === appNameInRoute);
        if (!appToEdit) {
            $location.url('/apps'); // app not found
        }
        $scope.editContext.appToEdit = appToEdit;
        appToEdit.hasPreDeployFunction = !!appToEdit.preDeployFunction;
        $scope.app = $scope.editContext.appToEdit;

        $scope.rootDomain = data.rootDomain;
        $scope.defaultNginxConfig = data.defaultNginxConfig;
        $scope.rootDomainWithProtocol = window.location.protocol + '//captain.' + data.rootDomain;
    });

    // it is called via interval and it is also called directly
    function fetchBuildLogs() {

        if (!$scope.editContext.appToEdit) {
            return;
        }

        var app = $scope.editContext.appToEdit;

        apiManager.fetchBuildLogs(app.appName, function (data) {

            if (captainToast.showErrorToastIfNeeded(data)) {
                return;
            }
            var logInfo = data.data;

            app.isAppBuilding = logInfo.isAppBuilding;

            if (app.isAppBuilding) {
                // forcefully expanding the view such that when building finishes it doesn't collapses automatically
                app.expandedLogs = true;
            }

            if (!app.buildLogs) {
                app.buildLogs = '';
            }

            if (app.lastLineNumberPrinted === undefined) {
                app.lastLineNumberPrinted = -10000;
            }

            var lines = logInfo.logs.lines;
            var firstLineNumberOfLogs = logInfo.logs.firstLineNumber;
            var firstLinesToPrint = 0;
            if (firstLineNumberOfLogs > app.lastLineNumberPrinted) {

                if (firstLineNumberOfLogs < 0) {
                    // This is the very first fetch, probably firstLineNumberOfLogs is around -50
                    firstLinesToPrint = -firstLineNumberOfLogs;
                } else {
                    app.buildLogs += '[[ TRUNCATED ]]\n';
                }

            } else {
                firstLinesToPrint = app.lastLineNumberPrinted - firstLineNumberOfLogs;
            }

            app.lastLineNumberPrinted = firstLineNumberOfLogs + lines.length;

            var lineAdded = false;

            for (var i = firstLinesToPrint; i < lines.length; i++) {

                app.buildLogs += ((lines[i] || '').trim() + '\n');

                lineAdded = true;

            }

            if (lineAdded) {
                setTimeout(function () {
                    var textarea = document.getElementById('buildlog-text-id');
                    if (textarea) textarea.scrollTop = textarea.scrollHeight;
                }, 500);
            }

        });
    }

    // Fetch the build logs immediately...
    fetchBuildLogs();

    // ... and every other second
    var promise = $interval(fetchBuildLogs, 2000);
    $scope.$on('$destroy', function () {
        $interval.cancel(promise);
    });

    (function AppDefinitionsContentCtrl() {

        $scope.onExpandLogClicked = function () {
            const app = $scope.editContext.appToEdit;
            app.expandedLogs = !app.expandedLogs;
        };

        $scope.onPreDeployFunctionToggled = function () {
            const app = $scope.editContext.appToEdit;
            app.hasPreDeployFunction = !app.hasPreDeployFunction;
        };

        $scope.onEnableBaseDomainSsl = function (appName) {
            $scope.loadingState.enabled = true;

            apiManager.enableSslForBaseDomain(appName, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    $scope.loadingState.enabled = false;
                    return;
                }

                var rootDomain = $scope.rootDomain;

                captainToast.showToastSuccess(
                    'HTTPS is now enabled for your domain at https://'
                    + appName + '.' + rootDomain);
                $state.reload();

            });
        };

        $scope.closeAppEdit = function () {
            $location.url('/apps');
        }

        $scope.unlockNodeId = function () {
            const app = $scope.editContext.appToEdit;
            app.unlockNodeIdForEdit = true;
        }

        $scope.addPortMappingClicked = function () {
            const app = $scope.editContext.appToEdit;
            if (!app.ports)
                app.ports = [];
            app.ports.push({containerPort: '', hostPort: ''});
        }

        $scope.addEnvVarClicked = function () {
            const app = $scope.editContext.appToEdit;
            if (!app.envVars)
                app.envVars = [];
            app.envVars.push({key: '', value: ''});
        }

        $scope.addVolumeClicked = function () {
            const app = $scope.editContext.appToEdit;
            if (!app.volumes)
                app.volumes = [];
            app.volumes.push({volumeName: '', containerPath: ''});
        }

        $scope.setHostPath = function (vol, path) {
            vol.hostPath = path;
            if (vol.hostPath) {
                vol.volumeName = '';
            }
        }

        $scope.onEditDefaultNginxConfigClicked = function () {
            const app = $scope.editContext.appToEdit;
            app.customNginxConfig = $scope.defaultNginxConfig;
        }

        $scope.onNewCustomDomainClicked = function (appName, newCustomDomain) {
            $scope.loadingState.enabled = true;

            apiManager.attachNewCustomDomainToApp(appName, newCustomDomain, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    $scope.loadingState.enabled = false;
                    return;
                }

                captainToast.showToastSuccess('Your new custom domain is attached to the app at http://'
                    + newCustomDomain);
                $state.reload();

            });
        };

        $scope.modalAppDelete = {};
        var modalAppDelete = $scope.modalAppDelete;

        $scope.onDeleteAppClicked = function (appName, hasPersistentData) {

            $scope.modalAppDelete.appName = appName;
            $scope.modalAppDelete.hasPersistentData = hasPersistentData;
            $scope.modalAppDelete.appNameConfirm = '';

            $uibModal.open({
                animation: true,
                templateUrl: 'templates/modals/delete-app.html',
                controller: function ($scope) {
                    $scope.modalAppDelete = modalAppDelete;
                },
                size: null
            }).result.then(function (returnValue) {

                if (!returnValue)
                    return;

                if ($scope.modalAppDelete.appNameConfirm !== appName) {
                    captainToast.showToastError('App name does not match. Delete cancelled...');
                    return;
                }

                $scope.loadingState.enabled = true;

                apiManager.deleteApp(appName, function (data) {

                    $scope.loadingState.enabled = false;

                    if (captainToast.showErrorToastIfNeeded(data)) {
                        return;
                    }

                    captainToast.showToastSuccess(
                        appName + ' is successfully deleted.');

                    $state.reload();
                });
            });
        };

        $scope.onUploadSourceCodeClicked = function () {
            const app = $scope.editContext.appToEdit;

            // file to upload is app.sourceToUpload
            console.log(app.sourceToUpload);

            $uibModal.open({
                animation: true,
                templateUrl: 'templates/modals/upload-source.html',
                controller: function ($scope) {
                    $scope.app = app;
                },
                size: null
            }).result.then(function (returnValue) {

                if (!returnValue)
                    return;

                $scope.loadingState.enabled = true;

                apiManager.uploadAppData(app.sourceToUpload, app.appName, function (data) {

                    $scope.loadingState.enabled = false;

                    if (captainToast.showErrorToastIfNeeded(data)) {
                        return;
                    }

                    captainToast.showToastSuccess(
                        app.appName + ' is successfully uploaded.');

                    app.lastLineNumberPrinted = undefined;
                    app.buildLogs = undefined;
                    fetchBuildLogs();

                });
            });
        };

        $scope.onEnableCustomDomainSslClicked = function (appName, publicDomain) {
            $scope.loadingState.enabled = true;

            apiManager.enableSslForCustomDomain(appName, publicDomain, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    $scope.loadingState.enabled = false;
                    return;
                }

                captainToast.showToastSuccess('HTTPS is now enabled for your domain at https://' + publicDomain);
                $state.reload();

            });
        };

        $scope.onRemoveCustomDomainClicked = function (appName, publicDomain) {
            $scope.loadingState.enabled = true;

            apiManager.removeCustomDomain(appName, publicDomain, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    $scope.loadingState.enabled = false;
                    return;
                }

                captainToast.showToastSuccess('You domain is successfully deleted: ' + publicDomain);
                $state.reload();

            });
        };

        $scope.onUpdateConfigAndSave = function () {
            const app = $scope.editContext.appToEdit;
            $scope.loadingState.enabled = true;

            var appDefinition = {
                instanceCount: app.instanceCount,
                envVars: app.envVars,
                ports: app.ports,
                nodeId: app.nodeId,
                notExposeAsWebApp: app.notExposeAsWebApp,
                forceSsl: app.forceSsl,
                appPushWebhook: app.appPushWebhook,
                customNginxConfig: app.customNginxConfig,
                preDeployFunction: app.hasPreDeployFunction ? app.preDeployFunction : null,
                volumes: app.volumes
            }

            apiManager.updateConfigAndSave(app.appName, appDefinition, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    $scope.loadingState.enabled = false;
                    return;
                }

                captainToast.showToastSuccess('You app data and configuration is successfully updated.');
                $state.reload();

            });
        };

    }())

}
