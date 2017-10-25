angular.module('RDash')
    .controller('NodesInfoCtrl', ['$scope', '$cookieStore',
        '$rootScope', 'pageDefinitions', 'apiManager', 'captainToast',
        '$uibModal', '$state', NodesInfoCtrl]);

function NodesInfoCtrl($scope, $cookieStore, $rootScope, pageDefinitions,
    apiManager, captainToast, $uibModal, $state) {

    $scope.loadingState = {};
    $scope.loadingState.enabled = true;

    $scope.allNodes = null;
    apiManager.getAllNodes(function (data) {
        $scope.loadingState.enabled = false;
        if (captainToast.showErrorToastIfNeeded(data)) {
            return;
        }

        $scope.allNodes = data.data;
    });

    (function NodesInfoContentCtrl() {

        $scope.nodeToAdd = {
            remoteUserName: 'root'
        };

        $scope.onAddNodeClicked = function () {
            $scope.loadingState.enabled = true;

            var nodeToAdd = $scope.nodeToAdd;

            apiManager.addDockerNode(nodeToAdd.nodeType, nodeToAdd.privateKey, nodeToAdd.remoteNodeIpAddress,
                nodeToAdd.remoteUserName, nodeToAdd.captainIpAddress, function (data) {

                    if (captainToast.showErrorToastIfNeeded(data)) {
                        $scope.loadingState.enabled = false;
                        return;
                    }

                    captainToast.showToastSuccess('Your new node is successfully added to your cluster.');
                    $state.reload();

                });
        };

    }());

}