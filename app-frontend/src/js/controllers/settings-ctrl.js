angular.module('RDash')
    .controller('SettingsCtrl', ['$scope', '$cookieStore',
        '$rootScope', 'pageDefinitions', 'apiManager', 'captainToast',
        '$uibModal', '$state', SettingsCtrl]);

function SettingsCtrl($scope, $cookieStore, $rootScope, pageDefinitions,
    apiManager, captainToast, $uibModal, $state) {

    $scope.loadingState = {};
    $scope.passwords = {};

    (function ChangePasswordCtrl() {

        $scope.onChangePasswordClicked = function () {
            $scope.loadingState.enabled = true;
            apiManager.changePassword($scope.passwords.oldPass, $scope.passwords.newPass, function (data) {

                $scope.loadingState.enabled = false;

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                captainToast.showToastSuccess('Password is changed...');

                $state.reload();
            });
        }
    }());

    (function UpdateCaptainCtrl() {

        function checkForUpdate() {
            $scope.loadingState.enabled = true;
            apiManager.getVersionInfo(function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                $scope.loadingState.enabled = false;
                $scope.versionInfo = data.data;

            });
        }

        checkForUpdate();

        $scope.onCheckForUpdatesClicked = function () {
            checkForUpdate();
        }

        $scope.onPerformUpdateClicked = function () {
            $scope.loadingState.enabled = true;
            apiManager.performUpdate($scope.versionInfo.latestVersion, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                captainToast.showToastSuccess('Update process has successfully started...');

                $scope.loadingState.enabled = false;

            });
        }

    }());

}