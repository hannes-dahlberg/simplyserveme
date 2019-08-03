"use strict";
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
var winston = require("winston");
var helper_service_1 = require("../services/helper.service");
var logType;
(function (logType) {
    logType["INFO"] = "info";
    logType["WARNING"] = "warn";
    logType["ERROR"] = "error";
})(logType = exports.logType || (exports.logType = {}));
var LogModule = (function () {
    function LogModule(outputToConsole, path) {
        var _a;
        if (outputToConsole === void 0) { outputToConsole = true; }
        var format = [
            winston.format.timestamp(),
            winston.format.printf(function (info) { return helper_service_1.helperService.dateTimeToString(info.timestamp) + " - " + info.level + ": " + info.message; }),
        ];
        this.logger = winston.createLogger({
            transports: (path !== undefined ? (function () {
                var _a;
                var matches = path.match(/^(.*\/)(.*)$/);
                return [new winston.transports.File({
                        dirname: matches[1],
                        filename: "" + matches[2],
                        format: (_a = winston.format).combine.apply(_a, format),
                    })];
            })() : []).concat((outputToConsole ? [new winston.transports.Console({
                    format: (_a = winston.format).combine.apply(_a, [
                        winston.format.colorize()
                    ].concat(format)),
                })] : [])),
        });
    }
    LogModule.prototype.info = function (log) {
        this.add(__assign({}, this.parseLogArgument(log), { type: logType.INFO }));
    };
    LogModule.prototype.warning = function (log) {
        this.add(__assign({}, this.parseLogArgument(log), { type: logType.WARNING }));
    };
    LogModule.prototype.error = function (log) {
        this.add(__assign({}, this.parseLogArgument(log), { type: logType.ERROR }));
    };
    LogModule.prototype.add = function (log) {
        if (typeof log === "string") {
            log = { title: log };
        }
        if (log.type === undefined) {
            log.type = logType.INFO;
        }
        this.logger.log({
            level: log.type,
            message: this.printLogMessage(log),
        });
    };
    LogModule.prototype.end = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.logger.on("close", function () {
                resolve();
            });
            _this.logger.end();
        });
    };
    LogModule.prototype.parseLogArgument = function (info) {
        if (typeof info === "string") {
            info = { title: info };
        }
        return info;
    };
    LogModule.prototype.printLogMessage = function (logMessage) {
        return "" + logMessage.title + (logMessage.message !== undefined ? ": \"" + logMessage.message + "\"" : "");
    };
    return LogModule;
}());
exports.LogModule = LogModule;
