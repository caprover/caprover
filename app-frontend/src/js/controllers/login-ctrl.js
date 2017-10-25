angular.module('RDash')
    .controller('LoginCtrl', ['$scope', '$cookieStore',
        '$rootScope', 'pageDefinitions', 'apiManager', 'captainToast',
        '$uibModal', '$location', '$state', LoginCtrl]);

function LoginCtrl($scope, $cookieStore, $rootScope, pageDefinitions,
    apiManager, captainToast, $uibModal, $location, $state) {

    $scope.data = {};

    $scope.onLoginClicked = function () {
        apiManager.login($scope.data.captainPassword, function (data) {
            if (captainToast.showErrorToastIfNeeded(data)) {
                return;
            }
            $location.path('/dashboard');
        });
    }

}