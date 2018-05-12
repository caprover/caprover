angular.module('RDash')
    .controller('NodesInfoCtrl', ['$scope', '$cookieStore',
        '$rootScope', 'pageDefinitions', 'apiManager', 'captainToast',
        '$uibModal', '$state', NodesInfoCtrl]);

function NodesInfoCtrl($scope, $cookieStore, $rootScope, pageDefinitions,
    apiManager, captainToast, $uibModal, $state) {

    $scope.loadingState = {
        nodes:{enabled : true},
        registry :{enabled : true}
    };

    $scope.captaininfo = {};

    apiManager.getCaptainInfo(function (data) {
        $scope.loadingState.registry.enabled = false;
        if (captainToast.showErrorToastIfNeeded(data)) {
            return;
        }

        $scope.captaininfo = data.data;
        $scope.captaininfo.hasCustomDomain = !!data.data.rootDomain;
        $scope.captaininfo.isRegistryLocal = $scope.captaininfo.dockerRegistryDomain.indexOf('registry.' + $scope.captaininfo.rootDomain + ':') === 0;
    });

    $scope.allNodes = null;
    apiManager.getAllNodes(function (data) {
        $scope.loadingState.nodes.enabled = false;
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
            $scope.loadingState.nodes.enabled = true;

            var nodeToAdd = $scope.nodeToAdd;

            apiManager.addDockerNode(nodeToAdd.nodeType, nodeToAdd.privateKey, nodeToAdd.remoteNodeIpAddress,
                nodeToAdd.remoteUserName, nodeToAdd.captainIpAddress, function (data) {

                    if (captainToast.showErrorToastIfNeeded(data)) {
                        $scope.loadingState.nodes.enabled = false;
                        return;
                    }

                    captainToast.showToastSuccess('Your new node is successfully added to your cluster.');
                    $state.reload();

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

            $scope.loadingState.registry.enabled = true;

            apiManager.enableDockerRegistry(type, domain, user, password, function (data) {
                $scope.loadingState.registry.enabled = false;

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                $uibModal.open({
                    animation: true,
                    templateUrl: 'templates/modals/simple.html',
                    size: null,
                    controller: function ($scope) {
                        $scope.message = 'Docker Registry has successfully been updated. ' +
                            'IMPORTANT NOTE: this takes a few minutes. You might see error meanwhile, ' +
                            'do not worry about the errors as your server is being set up! Please be patient!';
                        $scope.title = 'Success!';
                    }
                }).result.then(function () {
                    $state.reload();
                    setTimeout(function () {
                        window.location.reload(true);
                    }, 6000);
                });

            });
        }

        $scope.onLocalRegistryClicked = function () {

            $scope.loadingState.registry.enabled = true;

            apiManager.ensureRegistryHasSsl(function (data) {
                $scope.loadingState.registry.enabled = false;

                if (captainToast.showErrorToastIfNeeded(data)) {
                    return;
                }

                enableDockerRegistry(LOCAL);

            });

        };

        $scope.onRemoteRegistryClicked = function () {

            $scope.loadingState.registry.enabled = true;

            console.log($scope);

            enableDockerRegistry(REMOTE,
                $scope.remote.domain,
                $scope.remote.username,
                $scope.remote.password);

        };

    }());

}