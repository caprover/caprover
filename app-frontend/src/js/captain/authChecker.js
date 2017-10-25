angular.module('RDash')
    .run(['$rootScope', '$location', '$state', 'apiManager', 'captainLogger', '$timeout',
        function ($rootScope, $location, $state, apiManager, captainLogger, $timeout) {
            // for some reason stateChangeStart malfunctions... :/
            $rootScope.$on('$stateChangeSuccess', function (event, toState, toParams, fromState, fromParams) {

                if (!apiManager.isLoggedIn() && toState.url !== '/login') {
                    captainLogger.log('Not authorized : Redirecting to Login');
                    // event.preventDefault();
                    // Redirection doesn't always work if this 1ms delay is removed!
                    $timeout(function () {
                        $location.path('/login');
                    }, 1);
                } else {
                    captainLogger.log('Auth accepted.');
                }
            });

            $rootScope.onLogoutClicked = function () {
                apiManager.logout();
                // Intentionally redirecting to dashboard to get kicked out to login
                // This way we ensure that the user is indeed logged out
                $location.path('/dashboard');
            }
        }
    ])