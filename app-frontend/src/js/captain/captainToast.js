angular.module('RDash')
.factory('captainToast', function(toastr, apiManager) {


            var apiStatusCode = {

                STATUS_OK: 100,

                STATUS_ERROR_GENERIC: 1000,

                STATUS_ERROR_CAPTAIN_NOT_INITIALIZED: 1001,

                STATUS_ERROR_USER_NOT_INITIALIZED: 1101,

                STATUS_ERROR_NOT_AUTHORIZED: 1102,

                STATUS_ERROR_ALREADY_EXIST: 1103,

                STATUS_ERROR_BAD_NAME: 1104,

                STATUS_WRONG_PASSWORD: 1105,

                STATUS_AUTH_TOKEN_INVALID: 1106,

                VERIFICATION_FAILED: 1107

            };
        
            function showToastError(msg) {
                // toastr.warning('Hello world!', 'Toastr fun!');
                toastr.error(msg?msg:'ERROR', 'Error', {
                    "autoDismiss": false,
                    "positionClass": "toast-top-right",
                    "type": "error",
                    "timeOut": "5000",
                    "extendedTimeOut": "2000",
                    "allowHtml": false,
                    "closeButton": false,
                    "tapToDismiss": true,
                    "progressBar": false,
                    "newestOnTop": true,
                    "maxOpened": 0,
                    "preventDuplicates": false,
                    "preventOpenDuplicates": false
                })
            }
    
            function showToastSuccess(msg) {
                toastr.success(msg, '', {
                    "autoDismiss": false,
                    "positionClass": "toast-top-right",
                    "type": "error",
                    "timeOut": "5000",
                    "extendedTimeOut": "2000",
                    "allowHtml": false,
                    "closeButton": false,
                    "tapToDismiss": true,
                    "progressBar": false,
                    "newestOnTop": true,
                    "maxOpened": 0,
                    "preventDuplicates": false,
                    "preventOpenDuplicates": false
                })
            }
    
            return {
                showErrorToastIfNeeded: function(data) {
                    if (!data) {
                        showToastError('Please try again...');
                        return 99999;
                    }
                    if (data && data.status != 100) {
                        // Avoid showing auth token failure errors if there's not token. i.e., fresh page load
                        if (apiManager.isLoggedIn() || data.status !== apiStatusCode.STATUS_AUTH_TOKEN_INVALID) {
                            showToastError(data.description);
                        }
                        return data.status;
                    }
    
                    return null;
                },
                showToastSuccess: function(msg){
                    showToastSuccess(msg);
                },
                showToastError: function(msg){
                    showToastError(msg);
                }
            }
    
        });