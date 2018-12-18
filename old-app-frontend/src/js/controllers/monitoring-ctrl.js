angular.module('RDash')
    .controller('MonitoringCtrl', ['$scope', '$cookieStore',
        '$rootScope', 'pageDefinitions', 'apiManager', 'captainToast',
        '$uibModal', '$state', '$interval', MonitoringController]);

function MonitoringController($scope, $cookieStore, $rootScope, pageDefinitions,
    apiManager, captainToast, $uibModal, $state, $interval) {

    $scope.loadingState = {};
    $scope.captaininfo = {};

    $scope.loadingState.enabled = true;

    function fetchLoadBalancerInfo() {
        apiManager.getLoadBalancerInfo(function (data) {
            $scope.loadBalancerInfo = null;
            if (captainToast.showErrorToastIfNeeded(data)) {
                return;
            }
            $scope.loadBalancerInfo = data.data;
        });
    }

    var promise = $interval(fetchLoadBalancerInfo, 30000);
    $scope.$on('$destroy', function () {
        $interval.cancel(promise);
    });

    apiManager.getNetDataInfo(function (data) {
        $scope.loadingState.enabled = false;
        if (captainToast.showErrorToastIfNeeded(data)) {
            return;
        }
                
        fetchLoadBalancerInfo();
        $scope.netDataInfo = data.data;
    });

    /**
     * Root domain controller
     */
    (function DashboardRootdomainCtrl() {

        var updateNetData = function (setIsEnabledIfFailed) {
            apiManager.updateNetDataInfo($scope.netDataInfo, function (data) {

                if (captainToast.showErrorToastIfNeeded(data)) {
                    $scope.loadingState.enabled = false;
                    $scope.netDataInfo.isEnabled = setIsEnabledIfFailed;
                    return;
                }
                
                var isBeingEnabled = $scope.netDataInfo.isEnabled;

                $uibModal.open({
                    animation: true,
                    templateUrl: 'templates/modals/simple.html',
                    size: null,
                    controller: function ($scope) {

                        $scope.message = isBeingEnabled ?
                            'NetData is successfully updated.' : 'NetData is turned off.';
                        $scope.title = 'Success!';
                    }
                }).result.then(function () {
                    $state.reload();
                });

            });
        }

        $scope.onStartNetDataClicked = function () {
            $scope.loadingState.enabled = true;
            $scope.netDataInfo.isEnabled = true;
            updateNetData(false);
        };

        $scope.onStopNetDataClicked = function () {
            $scope.loadingState.enabled = true;
            $scope.netDataInfo.isEnabled = false;
            updateNetData(true);
        };

        $scope.onUpdateNetDataClicked = function () {
            $scope.loadingState.enabled = true;
            updateNetData(true);
        };

    }());

}