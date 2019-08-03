"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var express = require("express");
var fs = require("fs");
var httpProxyMiddleware = require("http-proxy-middleware");
var https = require("https");
var path = require("path");
var tls = require("tls");
var vhost = require("vhost");
var ipRangeCheck = require("ip-range-check");
var log_module_1 = require("../modules/log.module");
var service_module_1 = require("../modules/service.module");
var config_service_1 = require("./config.service");
var server_module_1 = require("../modules/server.module");
exports.Server = server_module_1.Server;
var serverState;
(function (serverState) {
    serverState["STARTED"] = "started";
    serverState["STARTING"] = "starting";
    serverState["STOPPING"] = "stopping";
    serverState["STOPPED"] = "stopped";
})(serverState || (serverState = {}));
var ServerService = (function (_super) {
    __extends(ServerService, _super);
    function ServerService(app, processes) {
        if (app === void 0) { app = express(); }
        if (processes === void 0) { processes = []; }
        var _this = _super.call(this) || this;
        _this.app = app;
        _this.processes = processes;
        _this._state = serverState.STOPPED;
        _this._servers = [];
        _this._connections = [];
        _this.certFiles = {};
        _this.configs = config_service_1.configService.attributes;
        _this.log = new log_module_1.LogModule(_this.configs.logOutputConsole, _this.logPath);
        config_service_1.configService.on("reload", function () {
            _this.log.add({ title: "Server", message: "Server config changes detected" });
            if (_this.configs.logOutputConsole && !config_service_1.configService.attributes.logOutputConsole) {
                console.log("Console log was turned of by server config. No more messages will be displayed");
            }
            _this.configs = config_service_1.configService.attributes;
            _this.log = new log_module_1.LogModule(_this.configs.logOutputConsole, _this.logPath);
            _this.restart();
        });
        return _this;
    }
    Object.defineProperty(ServerService.prototype, "logPath", {
        get: function () {
            return path.resolve(this.configs.logDumpPath, "server.log");
        },
        enumerable: true,
        configurable: true
    });
    ServerService.prototype.start = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this._state = serverState.STARTING;
            _this.hostWatcher = fs.watch(_this.configs.hostsPath, function () {
                _this.log.add({ title: "Hosts", message: "Detecting host file changes. Updating..." });
                _this.loadHosts(_this.app, _this.configs.hostsPath);
            });
            var connectionEventHandler = function (server) {
                server.on("connect", function (connection) {
                    _this._connections.push(connection);
                    connection.on("close", function () { return _this._connections = _this._connections.filter(function (connectionRef) { return connectionRef !== connection; }); });
                });
            };
            var httpServer = _this.app.listen(_this.configs.port, function () {
                _this.log.add("HTTP Server created listening on port " + _this.configs.port);
                var httpsServer = https.createServer({
                    key: "", cert: "", ca: "",
                    SNICallback: function (domain, callback) {
                        if (_this.certFiles[domain] !== undefined) {
                            callback(null, tls.createSecureContext(_this.certFiles[domain]));
                        }
                        else {
                            callback(null, tls.createSecureContext({ cert: "", key: "", ca: "" }));
                        }
                    },
                }, _this.app).listen(_this.configs.sslPort, function () {
                    _this._state = serverState.STARTED;
                    _this.log.add("HTTPS Server created listening on port " + _this.configs.sslPort);
                    _this.loadHosts(_this.app, config_service_1.configService.attributes.hostsPath);
                    _this.log.add({ title: "Server", message: "Server started" });
                    resolve();
                });
                connectionEventHandler(httpServer);
                connectionEventHandler(httpsServer);
                _this._servers.push(httpServer, httpsServer);
            });
        });
    };
    ServerService.prototype.stop = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this._state = serverState.STOPPING;
            _this.hostWatcher.close();
            _this.endConnections().then(function () { return _this.closeServers().then(function () {
                _this._state = serverState.STOPPED;
                _this.log.add({ title: "Server", message: "Server stopped" });
                resolve();
            }); });
        });
    };
    ServerService.prototype.restart = function () {
        var _this = this;
        if (this._state !== serverState.STARTED) {
            return;
        }
        this.log.add({ title: "Server", message: "Restarting server..." });
        this.log.add({ title: "Server", message: "Stopping server..." });
        this.stop().then(function () {
            _this.log.add({ title: "Server", message: "Starting server..." });
            _this.start().catch(function (error) {
                _this.log.add({ title: "Server", message: "Server failed to start", type: log_module_1.logType.ERROR, data: { error: error } });
            });
        }).catch(function (error) {
            _this.log.add({ title: "Server", message: "Server failed to shutdown", type: log_module_1.logType.ERROR, data: { error: error } });
        });
    };
    ServerService.prototype.endConnections = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this._connections.length === 0) {
                resolve();
                return;
            }
            _this._connections.forEach(function (connection) { return connection.end("", "", function () {
                _this._connections = _this._connections = _this._connections.filter(function (connectionRef) { return connectionRef !== connection; });
                if (_this._connections.length === 0) {
                    resolve();
                }
            }); });
            setTimeout(function () {
                _this._connections.forEach(function (connection) { return connection.destroy(); });
                resolve();
            }, 5000);
        });
    };
    ServerService.prototype.closeServers = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var hasResolved = false;
            if (_this._servers.length === 0) {
                resolve();
                return;
            }
            _this._servers.forEach(function (server) { return server.close(function () {
                _this._servers = _this._servers = _this._servers.filter(function (serverRef) { return serverRef !== server; });
                if (_this._servers.length === 0) {
                    if (!hasResolved) {
                        resolve();
                        hasResolved = true;
                    }
                }
            }); });
            setTimeout(function () {
                if (!hasResolved) {
                    _this._servers = [];
                    resolve();
                    hasResolved = true;
                }
            }, 1000);
        });
    };
    ServerService.prototype.loadHosts = function (app, hostsPath) {
        var _this = this;
        this.log.add({ title: "Host", message: "loading host configs..." });
        this.certFiles = {};
        var hosts = [];
        try {
            hosts = fs.readdirSync(hostsPath)
                .filter(function (host) { return host.match(/.+\.json$/); })
                .map(function (host) { return (__assign({}, JSON.parse(fs.readFileSync(path.resolve(hostsPath, host), "utf8")), { filename: host })); });
        }
        catch (error) {
            this.log.add({ title: "config parse error", message: "Error while parsing host files", type: log_module_1.logType.ERROR, data: error });
            return;
        }
        for (var _i = 0, hosts_1 = hosts; _i < hosts_1.length; _i++) {
            var host = hosts_1[_i];
            if (host.domain === undefined || host.target === undefined) {
                this.log.add({ title: "Missing config attributes", message: "missing either domain or target in config \"" + host.filename + "\"", type: log_module_1.logType.WARNING });
            }
        }
        if (hosts.length === 0) {
            this.log.add({ title: "Empty config list", message: "No configs were loaded" });
            return;
        }
        if (app._router !== undefined) {
            var vhostIndex = void 0;
            do {
                vhostIndex = app._router.stack.findIndex(function (stackItem) { return stackItem.name === "vhost"; });
                app._router.stack.splice(vhostIndex, 1);
            } while (vhostIndex !== -1);
        }
        try {
            hosts.filter(function (host) { return host.enable; }).forEach(function (host) {
                var vhostApp = express();
                if (host.letsEncryptAuth) {
                    vhostApp.get("/.well-known/acme-challenge/" + host.letsEncryptAuth.token, function (request, response, next) {
                        response.send(host.letsEncryptAuth.validation);
                    });
                }
                if (host.security !== undefined) {
                    _this.certFiles[host.domain] = {
                        key: fs.readFileSync(host.security.key, "utf8"),
                        cert: fs.readFileSync(host.security.cert, "utf8"),
                        ca: fs.readFileSync(host.security.ca, "utf8"),
                    };
                    if (host.redirectToHttps) {
                        vhostApp.get("*", function (request, response, next) {
                            if (request.protocol === "http") {
                                response.redirect("https://" + request.headers.host + request.url);
                                return;
                            }
                            next();
                        });
                    }
                }
                if (host.whiteListIps !== undefined || host.blackListIps !== undefined) {
                    vhostApp.all("*", function (request, response, next) {
                        if ((host.whiteListIps !== undefined && !ipRangeCheck(request.ip, host.whiteListIps)) || host.blackListIps !== undefined && ipRangeCheck(request.ip, host.blackListIps)) {
                            response.sendStatus(403);
                            return;
                        }
                        next();
                    });
                }
                if (host.exec) {
                    var id_1 = host.target;
                    var processIndex = _this.processes.findIndex(function (process) { return process.id === id_1; });
                    if (processIndex !== -1) {
                        _this.processes[processIndex].process.kill();
                        _this.processes.splice(processIndex, 1);
                    }
                    var execProcess = child_process_1.exec(host.exec);
                    _this.processes.push({ id: host.target, process: execProcess });
                    _this.log.add({ title: "Exec", message: "Exec process \"" + host.exec + "\"" });
                }
                if (!!host.target.match(/^http/)) {
                    vhostApp.use("/", httpProxyMiddleware({ target: host.target, changeOrigin: true, logLevel: "silent" }));
                    _this.log.add({ title: "Serve", message: "Serving proxy \"" + host.domain + "\" to \"" + host.target + "\"" });
                }
                else {
                    var staticPath_1 = path.resolve(host.target);
                    vhostApp.use(express.static(staticPath_1));
                    vhostApp.get("*", function (request, response) {
                        response.sendFile("index.html", { root: staticPath_1 });
                    });
                    _this.log.add({ title: "Serve", message: "Serving static content on " + host.domain + " from path: " + staticPath_1 });
                }
                app.use(vhost(host.domain, vhostApp));
            });
        }
        catch (error) {
            this.log.add({ title: "Webserver error", message: "Loading hosts to webserver somehow failed", type: log_module_1.logType.ERROR, data: error });
        }
    };
    return ServerService;
}(service_module_1.ServiceModule));
exports.server = new ServerService();
