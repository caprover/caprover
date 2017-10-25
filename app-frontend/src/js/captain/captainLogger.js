angular.module('RDash')
    .factory('captainLogger', function($log) {
        return {
            log: function(msg) {
                $log.log('#### ' + msg);
            },

            e: function(msg) {
                $.error('#### ' + msg);
            }
        }

    })