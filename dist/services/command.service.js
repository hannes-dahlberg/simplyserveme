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
var childProcess = require("child_process");
var fs = require("fs");
var os = require("os");
var path = require("path");
var __1 = require("..");
var config_service_1 = require("./config.service");
var server_service_1 = require("./server.service");
var CommandService = (function (_super) {
    __extends(CommandService, _super);
    function CommandService() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CommandService.prototype.start = function () {
        return server_service_1.server.start();
    };
    CommandService.prototype.init = function () {
        return new Promise(function (resolve, reject) {
            var configPath = path.resolve("./", "ssme.config.json");
            fs.writeFile(configPath, JSON.stringify(config_service_1.defaultConfig, null, 4), { flag: "wx", encoding: "utf8" }, function (error) {
                if (error && error.code === "EEXIST") {
                    reject(new Error(("Config file already exists at: \"" + configPath + "\". Will not overwrite.")));
                }
                else if (error) {
                    reject(new Error("Failed to create config path at: \"" + configPath + "\""));
                }
                else {
                    resolve(configPath);
                }
            });
        });
    };
    CommandService.prototype.create = function (domain, target, exec) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var host = __assign({ domain: domain,
                target: target }, (exec !== undefined ? { exec: exec } : undefined), { enable: true, whiteListIps: ["127.0.0.1"] });
            _this.saveHostFile(domain, host).then(function () { return resolve(); }).catch(function (error) { return reject(error); });
        });
    };
    CommandService.prototype.enableDisable = function (verb, domain) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.getHostFile(domain).then(function (host) {
                host.enable = verb === "enable";
                _this.saveHostFile(domain, host)
                    .then(function () { return resolve(verb === "enable" ? "enabled" : "disabled"); })
                    .catch(function (error) { return reject(error); });
            }).catch(function (error) { return reject(error); });
        });
    };
    CommandService.prototype.certify = function (domain) {
        return new Promise(function (resolve, reject) {
            childProcess.exec("certbot certonly" +
                " --manual" +
                (" -d \"" + domain + "\"") +
                " --manual-public-ip-logging-ok" +
                " --register-unsafely-without-email" +
                " --agree-tos" +
                " --manual-auth-hook \"ssme auth\"" +
                " --manual-cleanup-hook \"ssme cleanup\"" +
                (" --config-dir " + os.homedir() + "/.letsencrypt/config") +
                (" --work-dir " + os.homedir() + "/.letsencrypt/work") +
                (" --logs-dir " + os.homedir() + "/.letsencrypt/logs"), function (error) {
                if (error) {
                    reject(error);
                }
                resolve();
            });
        });
    };
    CommandService.prototype.auth = function (domain, token, validation) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.getHostFile(domain).then(function (host) {
                host.letsEncryptAuth = {
                    token: token,
                    validation: validation,
                };
                _this.saveHostFile(domain, host)
                    .then(function () { return resolve(); })
                    .catch(function (error) { return reject(error); });
            }).catch(function (error) { return reject(error); });
        });
    };
    CommandService.prototype.cleanup = function (domain) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.getHostFile(domain).then(function (host) {
                host.letsEncryptAuth = undefined;
                host.security = {
                    cert: os.homedir() + "/.letsencrypt/config/live/" + domain + "/cert.pem",
                    key: os.homedir() + "/.letsencrypt/config/live/" + domain + "/privkey.pem",
                    ca: os.homedir() + "/.letsencrypt/config/live/" + domain + "/chain.pem",
                };
                host.redirectToHttps = true;
                _this.saveHostFile(domain, host)
                    .then(function () { return resolve(); })
                    .catch(function (error) { return reject(error); });
            }).catch(function (error) { return reject(error); });
        });
    };
    CommandService.prototype.getHostFile = function (domain) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            try {
                resolve(JSON.parse(fs.readFileSync(_this.getHostFilePath(domain), "utf8")));
            }
            catch (error) {
                reject(error);
            }
        });
    };
    CommandService.prototype.saveHostFile = function (domain, data) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            try {
                fs.writeFileSync(_this.getHostFilePath(domain), JSON.stringify(data, null, 4), "utf8");
                resolve();
            }
            catch (error) {
                reject(error);
            }
        });
    };
    CommandService.prototype.getHostFilePath = function (domain) {
        return path.resolve(config_service_1.configService.attributes.hostsPath, domain + ".json");
    };
    return CommandService;
}(__1.ServiceModule));
exports.CommandService = CommandService;
exports.commandService = CommandService.getInstance();
