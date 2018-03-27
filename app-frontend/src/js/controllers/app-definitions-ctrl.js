angular.module('RDash')
    .controller('AppDefinitionCtrl', ['$scope','apiManager', 'captainToast','$state', '$location', 
                                        AppDefinitionCtrl]);

function AppDefinitionCtrl($scope, apiManager, captainToast, $state, $location) {

    $scope.loadingState = {};
    $scope.loadingState.enabled = true;
    $scope.search = {};

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
            $location.url('/apps/'+ app.appName);
        }

    }())

}
