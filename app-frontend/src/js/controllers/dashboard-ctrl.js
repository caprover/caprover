angular.module('RDash')
    .controller('DashboardController', ['$scope', '$cookieStore',
        '$rootScope', 'pageDefinitions', 'apiManager', 'captainToast',
        '$uibModal', '$state', '$interval', DashboardController]);

function DashboardController($scope, $cookieStore, $rootScope, pageDefinitions,
    apiManager, captainToast, $uibModal, $state, $interval) {

    $scope.loadingState = {};
    $scope.captaininfo = {};

    $scope.loadingState.enabled = true;

    apiManager.getCaptainInfo(function (data) {
        $scope.loadingState.enabled = false;
        if (captainToast.showErrorToastIfNeeded(data)) {
            return;
        }

        $scope.captaininfo = data.data;
        $scope.captaininfo.hasCustomDomain = !!data.data.rootDomain;
        $scope.captaininfo.isRegistryLocal = $scope.captaininfo.dockerRegistryDomain.indexOf('registry.' + $scope.captaininfo.rootDomain + ':') === 0;
    });

    /**
     * Root domain controller
     */
    (function DashboardRootdomainCtrl() {

        $scope.onUpdateDomainClicked = function () {
            $scope.loadingState.enabled = true;

            apiManager.updateRootDomain($scope.captaininfo.rootDomain, function (data) {
                $scope.loadingState.enabled = false;

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                $uibModal.open({
                    animation: true,
                    templateUrl: 'templates/modals/simple.html',
                    size: null,
                    controller: function ($scope) {
                        $scope.message = 'Root domain has been successfully updated. Click Ok to get redirected to your new root domain.';
                        $scope.title = 'Success!';
                    }
                }).result.then(function () {
                    // intentionally using replace instead of href to avoid letting user to go back.
                    window.location.replace('http://captain.' + $scope.captaininfo.rootDomain);
                });

            });
        };

        $scope.onForceSslClicked = function () {

            $uibModal.open({
                animation: true,
                templateUrl: 'templates/modals/force-ssl.html',
                size: null
            }).result.then(function (returnValue) {

                if (!returnValue)
                    return;

                $scope.loadingState.enabled = true;

                apiManager.forceSsl(true, function (data) {

                    $scope.loadingState.enabled = false;

                    if (captainToast.showErrorToastIfNeeded(data)) {
                        return;
                    }

                    $uibModal.open({
                        animation: true,
                        templateUrl: 'templates/modals/simple.html',
                        size: null,
                        controller: function ($scope) {
                            $scope.message = 'HTTPS is now being force. Click Ok to get redirected to your secure website.';
                            $scope.title = 'Success!';
                        }
                    }).result
                        .catch(function () { })
                        .then(function () {
                            // intentionally using replace instead of href to avoid letting user to go back.
                            window.location.replace('https://captain.' + $scope.captaininfo.rootDomain);
                        });
                });
            });
        };

        $scope.modaldata = {};
        $scope.modaldata.emailaddress = '';
        var modaldata = $scope.modaldata;

        $scope.onEnableSslClicked = function () {

            $uibModal.open({
                animation: true,
                templateUrl: 'templates/modals/enable-ssl.html',
                size: null,
                controller: function ($scope) {
                    $scope.modaldata = modaldata;
                },
                resolve: {
                    items: function () {
                        return 1;
                    }
                }
            }).result.then(function (err) {
                console.log(err);
                $scope.loadingState.enabled = true;

                apiManager.enablessl($scope.modaldata.emailaddress, function (data) {
                    $scope.loadingState.enabled = false;

                    if (captainToast.showErrorToastIfNeeded(data)) {
                        return;
                    }

                    $uibModal.open({
                        animation: true,
                        templateUrl: 'templates/modals/simple.html',
                        size: null,
                        controller: function ($scope) {
                            $scope.message = 'HTTPS is successfully enabled. Click Ok to get redirected to your secure website.';
                            $scope.title = 'Success!';
                        }
                    }).result.then(function () {
                        // intentionally using replace instead of href to avoid letting user to go back.
                        window.location.replace('https://captain.' + $scope.captaininfo.rootDomain);
                    });
                });
            });
        };
    }());


    /**
     * Registry Controller
     */
    (function DashboardDockerRegistryCtrl() {

        var LOCAL = 'local';
        var REMOTE = 'remote';

        $scope.remote = {};

        var enableDockerRegistry = function (type, domain, user, password) {

            $scope.loadingState.enabled = true;

            apiManager.enableDockerRegistry(type, domain, user, password, function (data) {
                $scope.loadingState.enabled = false;

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                $uibModal.open({
                    animation: true,
                    templateUrl: 'templates/modals/simple.html',
                    size: null,
                    controller: function ($scope) {
                        $scope.message = 'Docker Registry has successfully been updated. IMPORTANT NOTE: it will take up to a minute for you to see this change! Please be patient!';
                        $scope.title = 'Success!';
                    }
                }).result.then(function () {
                    $state.reload();
                });

            });
        }

        $scope.onLocalRegistryClicked = function () {

            $scope.loadingState.enabled = true;

            apiManager.ensureRegistryHasSsl(function (data) {
                $scope.loadingState.enabled = false;

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                enableDockerRegistry(LOCAL);

            });

        };

        $scope.onRemoteRegistryClicked = function () {

            $scope.loadingState.enabled = true;

            console.log($scope)

            enableDockerRegistry(REMOTE,
                $scope.remote.domain,
                $scope.remote.username,
                $scope.remote.password);

        };

    }());

}