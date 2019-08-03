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
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var os = require("os");
var path = require("path");
var service_module_1 = require("../modules/service.module");
var CONFIG_PATH = path.resolve("./ssme.config.json");
exports.defaultConfig = {
    port: 80,
    sslPort: 443,
    logOutputConsole: false,
    logDumpPath: path.resolve(os.homedir(), ".ssme/log"),
    hostsPath: path.resolve(os.homedir(), ".ssme/hosts"),
};
var ConfigService = (function (_super) {
    __extends(ConfigService, _super);
    function ConfigService() {
        var _this = _super.call(this) || this;
        _this._attributes = exports.defaultConfig;
        _this._ons = [];
        _this.readConfigFile();
        _this.watcher();
        return _this;
    }
    Object.defineProperty(ConfigService.prototype, "attributes", {
        get: function () { return this._attributes; },
        enumerable: true,
        configurable: true
    });
    ConfigService.prototype.on = function (verb, callback) {
        var _this = this;
        this._ons.push({ verb: verb, callback: callback });
        return {
            unsubscribe: function () {
                var callbackStoreIndex = _this._ons.findIndex(function (callbackStore) { return callback === callbackStore.callback; });
                if (callbackStoreIndex !== -1) {
                    _this._ons.splice(callbackStoreIndex, 1);
                }
            },
        };
    };
    ConfigService.prototype.watcher = function () {
        var _this = this;
        fs.watchFile(CONFIG_PATH, function () {
            _this.readConfigFile();
        });
    };
    ConfigService.prototype.readConfigFile = function () {
        if (fs.existsSync(CONFIG_PATH)) {
            try {
                this._attributes = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
            }
            catch (error) {
            }
            this.reloading();
            return;
        }
    };
    ConfigService.prototype.reloading = function () {
        var _this = this;
        this._ons.filter(function (value) { return value.verb === "reload"; }).forEach(function (value) { return value.callback(_this._attributes); });
    };
    return ConfigService;
}(service_module_1.ServiceModule));
exports.ConfigService = ConfigService;
exports.configService = ConfigService.getInstance();
