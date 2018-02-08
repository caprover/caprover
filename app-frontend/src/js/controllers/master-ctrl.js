/**
 * Master Controller
 */

angular.module('RDash')
    .controller('MasterCtrl', ['$scope', '$cookieStore', '$rootScope', 'pageDefinitions', 
    '$location', 'apiManager', MasterCtrl]);

function MasterCtrl($scope, $cookieStore, $rootScope, pageDefinitions
    , $location, apiManager) {
    
    $scope.isFullPage = true;

    $rootScope.$on('$stateChangeStart', function (event, toState, toParams, fromState, fromParams) {
        $scope.routePath = toState.url;
        $scope.pageName = '';
        for (var count = 0; count < pageDefinitions.length; count++) {
            if (pageDefinitions[count].url == toState.url){
                $scope.pageName = pageDefinitions[count].name;
                $scope.isFullPage = pageDefinitions[count].isFullPage || !apiManager.isLoggedIn();
            }
        }
    });

    $scope.onLogoutClicked = function(){
        apiManager.logout();
        $location.path('/login');
    }

    /**
     * Sidebar Toggle & Cookie Control
     */
    var mobileView = 992;

    $scope.getWidth = function () {
        return window.innerWidth;
    };

    $scope.pageDefinitions = [];

    for (var i = 0; i < pageDefinitions.length; i++) {
        if (pageDefinitions[i].icon){
            $scope.pageDefinitions.push(pageDefinitions[i]);
        }
    }

    $scope.$watch($scope.getWidth, function (newValue, oldValue) {
        if (newValue >= mobileView) {
            if (angular.isDefined($cookieStore.get('toggle'))) {
                $scope.toggle = !$cookieStore.get('toggle') ? false : true;
            } else {
                $scope.toggle = true;
            }
        } else {
            $scope.toggle = false;
        }

    });

    $scope.toggleSidebar = function () {
        $scope.toggle = !$scope.toggle;
        $cookieStore.put('toggle', $scope.toggle);
    };

    window.onresize = function () {
        $scope.$apply();
    };
}