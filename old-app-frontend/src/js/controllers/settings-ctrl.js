angular.module('RDash')
    .controller('SettingsCtrl', ['$scope', '$cookieStore',
        '$rootScope', 'pageDefinitions', 'apiManager', 'captainToast',
        '$uibModal', '$state', SettingsCtrl]);

function SettingsCtrl($scope, $cookieStore, $rootScope, pageDefinitions,
                      apiManager, captainToast, $uibModal, $state) {

    $scope.loadingState = {
        changePassword: {},
        versionCheck: {},
        cleanUp: {},
        nginxConfig: {}
    };

    $scope.cleanUp = {};
    $scope.cleanUp.mostRecentLimit = 2;

    $scope.passwords = {};

    (function ChangePasswordCtrl() {

        $scope.onChangePasswordClicked = function () {
            $scope.loadingState.changePassword.enabled = true;
            apiManager.changePassword($scope.passwords.oldPass, $scope.passwords.newPass, function (data) {

                $scope.loadingState.changePassword.enabled = false;

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
            $scope.loadingState.versionCheck.enabled = true;
            apiManager.getVersionInfo(function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                $scope.loadingState.versionCheck.enabled = false;
                $scope.versionInfo = data.data;

            });
        }

        checkForUpdate();

        $scope.onCheckForUpdatesClicked = function () {
            checkForUpdate();
        }

        $scope.onPerformUpdateClicked = function () {
            $scope.loadingState.versionCheck.enabled = true;
            apiManager.performUpdate($scope.versionInfo.latestVersion, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                captainToast.showToastSuccess('Update process has successfully started...');

                setTimeout(function () {
                    window.location.reload(true);
                }, 6000);

                $scope.loadingState.versionCheck.enabled = false;

            });
        }

    }());

    (function cleanUpCtrl() {
        $scope.onGetOldImagesClicked = function () {
            $scope.loadingState.cleanUp.enabled = true;
            apiManager.getUnusedImages($scope.cleanUp.mostRecentLimit, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                $scope.loadingState.cleanUp.enabled = false;
                var unusedImages = data.data.unusedImages;
                for (var i = 0; i < unusedImages.length; i++) {
                    unusedImages[i].remove = true;
                }
                $scope.cleanUp.unusedImages = unusedImages;
            });
        }

        $scope.onRemoveImagesClicked = function () {

            $scope.loadingState.cleanUp.enabled = true;

            var imageIds = [];
            for (var i = 0; i < $scope.cleanUp.unusedImages.length; i++) {
                if ($scope.cleanUp.unusedImages[i].remove) {
                    imageIds.push($scope.cleanUp.unusedImages[i].id);
                }
            }

            apiManager.deleteImages(imageIds, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                $scope.loadingState.cleanUp.enabled = false;

                // forcing a refresh
                $scope.onGetOldImagesClicked();

            });
        }


    }());

    (function nginxConfigCtrl() {

        function getInitialValues() {
            $scope.loadingState.nginxConfig.enabled = true;
            apiManager.getNginxConfig(function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                $scope.loadingState.nginxConfig.enabled = false;
                $scope.nginxConfig = data.data;

            });
        }

        getInitialValues();

        $scope.onLoadDefaultNginxConfigClicked = function () {
            $scope.nginxConfig.baseConfig.customValue = $scope.nginxConfig.baseConfig.byDefault;
            $scope.nginxConfig.captainConfig.customValue = $scope.nginxConfig.captainConfig.byDefault;
        }

        $scope.onUpdateNginxConfigClicked = function () {
            $scope.loadingState.nginxConfig.enabled = true;
            apiManager.setNginxConfig($scope.nginxConfig.baseConfig.customValue,
                $scope.nginxConfig.captainConfig.customValue, function (data) {

                    if (captainToast.showErrorToastIfNeeded(data)) {
                        return;
                    }

                    captainToast.showToastSuccess('Nginx is succesfully updated, restarting Captain in 10 seconds...');

                    setTimeout(function () {
                        window.location.reload(true);
                    }, 6000);

                    $scope.loadingState.nginxConfig.enabled = false;

                });
        }

    }());

}