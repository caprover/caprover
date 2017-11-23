angular.module('RDash')
    .controller('OneClickAppsCtrl', ['$scope', '$ocLazyLoad',
        '$rootScope', 'captainOneClickApps', 'apiManager', 'captainToast',
        '$uibModal', '$state', OneClickAppsCtrl]);

if (typeof oneClickAppsRepository === 'undefined') {
    var oneClickAppsRepository = {};
}

function OneClickAppsCtrl($scope, $ocLazyLoad, $rootScope, captainOneClickApps,
    apiManager, captainToast, $uibModal, $state) {

    $scope.loadingState = {};
    $scope.loadingState.enabled = true;

    $scope.oneClickAppList;
    $scope.selectedApp = {};
    $scope.selectedTemplate = {};

    apiManager.getOneClickAppList(function (data) {
        $scope.loadingState.enabled = false;
        if (captainToast.showErrorToastIfNeeded(data)) {
            return;
        }

        $scope.oneClickAppList = data.data;
    });

    (function NodesInfoContentCtrl() {

        $scope.onOneClickAppSelected = function () {

            $scope.loadingState.enabled = true;

            captainOneClickApps.getTemplate($ocLazyLoad, $scope.selectedApp.id, function (template) {

                $scope.selectedTemplate.firstStep = template;
                $scope.selectedTemplate.currentStep = template;

                console.log(template);
                console.log('------------------------------------');

                // use template to kickoff the wizard

            });
        };
    }());

}