var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var httpProxy = require('http-proxy').createProxyServer({});
var CaptainManager = require('./user/CaptainManager');
var BaseApi = require('./api/BaseApi');
var ApiStatusCodes = require('./api/ApiStatusCodes');
var Injector = require('./injection/Injector');
var Logger = require('./utils/Logger');
var CaptainConstants = require('./utils/CaptainConstants');
var LoginRouter = require('./routes/LoginRouter');
var UserRouter = require('./routes/UserRouter');
var app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
if (CaptainConstants.isDebug) {
    app.use('*', function (req, res, next) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Headers', CaptainConstants.header.namespace + ',' + CaptainConstants.header.auth + ',Content-Type');
        next();
    });
    app.use('/force-exit', function (req, res, next) {
        res.send('Okay... I will exit in a second...');
        setTimeout(function () {
            process.exit(0);
        }, 500);
    });
}
app.use(Injector.injectGlobal());
app.use(function (req, res, next) {
    if (res.locals.forceSsl) {
        var isRequestSsl = (req.secure || req.get('X-Forwarded-Proto') === 'https');
        if (!isRequestSsl) {
            var newUrl = 'https://' + req.get('host') + req.originalUrl;
            res.redirect(302, newUrl);
            return;
        }
    }
    next();
});
if (!CaptainConstants.isDebug) {
    app.use(express.static(path.join(__dirname, 'dist-frontend')));
}
app.use(express.static(path.join(__dirname, 'public')));
app.use(CaptainConstants.healthCheckEndPoint, function (req, res, next) {
    res.send(CaptainManager.get().getHealthCheckUuid());
});
//  ************  Beginning of reverse proxy 3rd party services  ****************************************
app.use(CaptainConstants.netDataRelativePath, function (req, res, next) {
    if (req.originalUrl.indexOf(CaptainConstants.netDataRelativePath + '/') !== 0) {
        var newUrl = 'https://' + req.get('host') + CaptainConstants.netDataRelativePath + '/';
        res.redirect(302, newUrl);
        return;
    }
    next();
});
app.use(CaptainConstants.netDataRelativePath, Injector.injectUserUsingCookieDataOnly());
app.use(CaptainConstants.netDataRelativePath, function (req, res, next) {
    if (!res.locals.user) {
        Logger.e('User not logged in for NetData');
        res.sendStatus(500);
    }
    else {
        next();
    }
});
app.use(CaptainConstants.netDataRelativePath, function (req, res, next) {
    httpProxy.web(req, res, { target: 'http://' + CaptainConstants.netDataContainerName + ':19999' });
    httpProxy.on('error', function (err, req, res) {
        if (res.locals.errorProxyHandled) {
            return;
        }
        if (err) {
            Logger.e(err);
        }
        res.locals.errorProxyHandled = true;
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });
        res.end('Something went wrong... err: \n ' + (err ? err : 'NULL'));
    });
});
//  ************  End of reverse proxy 3rd party services  ****************************************
//  *********************  Beginning of API End Points  *******************************************
var API_PREFIX = '/api/';
app.use(API_PREFIX + ':apiVersionFromRequest/', function (req, res, next) {
    if (req.params.apiVersionFromRequest !== CaptainConstants.apiVersion) {
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, 'This captain instance only accepts API V1.'));
        return;
    }
    if (!res.locals.initialized) {
        var response = new BaseApi(ApiStatusCodes.STATUS_ERROR_CAPTAIN_NOT_INITIALIZED, 'Captain is not ready yet...');
        res.send(response);
        return;
    }
    if (!res.locals.namespace && !req.originalUrl.startsWith(API_PREFIX + CaptainConstants.apiVersion + '/user/webhooks/')) {
        res.send(new BaseApi(ApiStatusCodes.STATUS_ERROR_GENERIC, 'no namespace'));
        return;
    }
    next();
});
// unsecured end points:
app.use(API_PREFIX + CaptainConstants.apiVersion + '/login/', LoginRouter);
// secured end points
app.use(API_PREFIX + CaptainConstants.apiVersion + '/user/', UserRouter);
//  *********************  End of API End Points  *******************************************
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});
// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    Logger.e(err);
    // render the error page
    res.status(err.status || 500);
    res.render('error');
});
// Initializing with delay helps with debugging. Many times, docker didn't see the CAPTAIN service
// if this was done without a delay
setTimeout(function () {
    CaptainManager.get().initialize();
}, 1500);
module.exports = app;
