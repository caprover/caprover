angular.module('RDash')
    .factory('captainOneClickApps', function (apiManager) {

        var SUCCESS = 'SUCCESS';
        var ERROR = 'ERROR';

        return {
            getTemplate: function ($ocLazyLoad, appTemplateId, callback) {

                if (oneClickAppsRepository && oneClickAppsRepository[appTemplateId]) {
                    callback(oneClickAppsRepository[appTemplateId](apiManager));
                    return;
                }

                $ocLazyLoad.load(
                    ['/oneclick-apps/' + appTemplateId + '.js'
                    ])
                    .then(function () {
                        callback(oneClickAppsRepository[appTemplateId](apiManager));
                    });

            }
        }

    });