"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bodyParser = require("body-parser");
var cors = require("cors");
var express = require("express");
var https = require("https");
var tls = require("tls");
var vhost = require("vhost");
var Server = (function () {
    function Server(apps, port, securePort) {
        if (port === void 0) { port = 80; }
        if (securePort === void 0) { securePort = 443; }
        this.port = port;
        this.securePort = securePort;
        if (!(apps instanceof Array)) {
            apps = [apps];
        }
        this.apps = apps;
        this.server = express();
        for (var _i = 0, apps_1 = apps; _i < apps_1.length; _i++) {
            var app = apps_1[_i];
            this.server.use(this.createApp(app));
        }
    }
    Server.prototype.start = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var listener = _this.server.listen(_this.port, function () {
                _this.apps.filter(function (app) { return !app.https || (app.https && !app.httpsRedirect); }).forEach(function (app) {
                    console.log("Serving " + _this.appType(app).toUpperCase() + " on: http://" + app.domain + ":" + _this.port + (("staticPath" in app) ? " with static root: \"" + app.staticPath + "\"" : ""));
                });
                resolve(listener);
            });
            if (_this.apps.find(function (app) { return app.https; })) {
                var server = https.createServer({
                    SNICallback: function (domain, callback) {
                        var config = _this.apps.find(function (app) { return app.domain === domain && app.https && app.credentials !== undefined; });
                        if (config !== undefined) {
                            callback(null, tls.createSecureContext({
                                cert: config.credentials.cert,
                                key: config.credentials.key,
                            }));
                        }
                        else {
                            callback(null, tls.createSecureContext({
                                cert: "",
                                key: "",
                            }));
                        }
                    },
                    key: "",
                    cert: "",
                }, _this.server);
                if (_this.securePort !== undefined) {
                    server.listen(_this.securePort, function () {
                        _this.apps.filter(function (app) { return app.https && app.credentials !== undefined; }).forEach(function (app) {
                            console.log("Serving " + _this.appType(app).toUpperCase() + " on: https://" + app.domain + ":" + _this.securePort + (("staticPath" in app) ? " with static root: \"" + app.staticPath + "\"" : ""));
                        });
                    });
                }
            }
        });
    };
    Server.prototype.createApp = function (appData) {
        var _this = this;
        var app = express();
        if (appData.https && appData.credentials === undefined) {
            throw new Error("HTTPS is turned on but certificat property is missing");
        }
        if (appData.https && appData.httpsRedirect) {
            app.get("*", function (request, response, next) {
                if (request.protocol === "http") {
                    response.redirect("https://" + request.headers.host.replace(":" + _this.port, ":" + _this.securePort) + request.url);
                    return;
                }
                next();
            });
        }
        if (this.appType(appData) === "api") {
            var tempAppData = appData;
            if (tempAppData.corsConfig) {
                if (typeof tempAppData.corsConfig === "string" || tempAppData.corsConfig instanceof Array) {
                    tempAppData.corsConfig = {
                        origin: tempAppData.corsConfig,
                    };
                }
                app.use(cors(tempAppData.corsConfig));
            }
            app.use(bodyParser.urlencoded({
                extended: true,
            }));
            app.use(bodyParser.json());
            if (tempAppData.routes) {
                app.use("/", tempAppData.routes);
            }
        }
        else if (this.appType(appData) === "spa") {
            var tempAppData_1 = appData;
            if (tempAppData_1.apiBaseUrl !== undefined) {
                app.head("/api_base_url", function (request, response, next) {
                    response.setHeader("api_base_url", tempAppData_1.apiBaseUrl);
                    next();
                });
            }
            app.use(express.static(tempAppData_1.staticPath));
            app.get("*", function (request, response) {
                response.sendFile("index.html", { root: tempAppData_1.staticPath });
            });
        }
        return vhost(appData.domain, app);
    };
    Server.prototype.appType = function (app) {
        return "staticPath" in app ? "spa" : "api";
    };
    return Server;
}());
exports.Server = Server;
