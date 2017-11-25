angular.module('RDash')
    .controller('OneClickAppsCtrl', ['$scope', '$ocLazyLoad',
        '$rootScope', 'captainOneClickApps', 'apiManager', 'captainToast',
        '$uibModal', '$location', OneClickAppsCtrl]);

if (typeof oneClickAppsRepository === 'undefined') {
    var oneClickAppsRepository = {};
}

function OneClickAppsCtrl($scope, $ocLazyLoad, $rootScope, captainOneClickApps,
    apiManager, captainToast, $uibModal, $location) {

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

    $scope.onOneClickAppNextStepClicked = function () {

        // It was the last step...
        if (!$scope.selectedTemplate.currentStep.next) {
            $location.path('/apps');
            return;
        }

        $scope.loadingState.enabled = true;

        var dataToProcess = {};
        var array = $scope.selectedTemplate.currentStep.next.data;

        for (var index = 0; index < array.length; index++) {
            const element = array[index];
            dataToProcess[element.id] = element.value;
        }

        $scope.selectedTemplate.currentStep.next.process(dataToProcess, function (nextStep) {
            $scope.loadingState.enabled = false;
            $scope.selectedTemplate.currentStep = nextStep;
        });
    }

    $scope.onOneClickAppSelected = function () {

        $scope.loadingState.enabled = true;

        captainOneClickApps.getTemplate($ocLazyLoad, $scope.selectedApp.id, function (template) {

            $scope.selectedTemplate.firstStep = template;
            $scope.selectedTemplate.currentStep = template;

            $scope.loadingState.enabled = false;
        });
    };
}