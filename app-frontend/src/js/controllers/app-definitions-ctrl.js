angular.module('RDash')
    .controller('AppDefinitionCtrl', ['$scope', '$cookieStore',
        '$rootScope', 'pageDefinitions', 'apiManager', 'captainToast',
        '$uibModal', '$state', '$location', AppDefinitionCtrl]);

function AppDefinitionCtrl($scope, $cookieStore, $rootScope, pageDefinitions,
    apiManager, captainToast, $uibModal, $state, $location) {

    $scope.loadingState = {};
    $scope.loadingState.enabled = true;
    $scope.search = {};
    $scope.editContent = {
        appsToEdit: []
    };

    $scope.allApps = null;
    apiManager.getAllApps(function (data) {
        $scope.loadingState.enabled = false;
        if (captainToast.showErrorToastIfNeeded(data)) {
            return;
        }

        $scope.allApps = data.data;

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

        $scope.rootDomain = data.rootDomain;

    });

    (function AppDefinitionsContentCtrl() {

        $scope.newAppData = {};

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

        $scope.onCreateOneClickAppClick = function () {
            $location.path('/oneclickapps');
        }

        $scope.onCreateNewAppClicked = function () {
            $scope.loadingState.enabled = true;

            var appName = $scope.newAppData.newAppToRegister;
            var hasPersistentData = $scope.newAppData.newAppHasPersistentData;

            apiManager.registerNewApp(appName, hasPersistentData, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    $scope.loadingState.enabled = false;
                    return;
                }

                captainToast.showToastSuccess('You new app is registered ' + appName);
                $state.reload();

            });
        };

        $scope.openAppEdit = function (app) {
            // Make a copy of app object to avoid showing the unsaved data in the table
            $scope.editContent.appsToEdit.push(JSON.parse(JSON.stringify(app)));
        }

        $scope.closeAppEdit = function (app) {
            var idx = $scope.editContent.appsToEdit.indexOf(app);
            if (idx > -1) {
                $scope.editContent.appsToEdit.splice(idx, 1);
            }
        }

        $scope.addEnvVarClicked = function (app) {
            if (!app.envVars)
                app.envVars = [];
            app.envVars.push({ key: '', value: '' });
        }

        $scope.addVolumeClicked = function (app) {
            if (!app.volumes)
                app.volumes = [];
            app.volumes.push({ volumeName: '', containerPath: '' });
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

        $scope.onDeleteAppClicked = function (appName) {

            $scope.modalAppDelete.appName = appName;
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

        $scope.onUploadSourceCodeClicked = function (app) {

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
                        app.appName + ' is successfully uploaded & updated.');

                    $state.reload();
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

        $scope.onUpdateConfigAndSave = function (app) {
            $scope.loadingState.enabled = true;

            var appDefinition = {
                instanceCount: app.instanceCount,
                envVars: app.envVars,
                notExposeAsWebApp: app.notExposeAsWebApp,
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
