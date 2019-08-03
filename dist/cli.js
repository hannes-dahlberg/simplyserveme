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
var fs = require("fs");
var path = require("path");
var yargs = require("yargs");
var log_module_1 = require("./modules/log.module");
var command_service_1 = require("./services/command.service");
var config_service_1 = require("./services/config.service");
var helper_service_1 = require("./services/helper.service");
var cTable = require("console.table");
var Certificate = require("@fidm/x509").Certificate;
var log = new log_module_1.LogModule();
var enableDisable = function (verb, domain) {
    var hostFilePath = path.resolve(config_service_1.configService.attributes.hostsPath, domain + ".json");
    var host = JSON.parse(fs.readFileSync(hostFilePath, "utf8"));
    host.enable = verb === "enable";
    fs.writeFileSync(hostFilePath, JSON.stringify(host, null, 4), "utf8");
    log.add("Host \"" + host.domain + "\" was " + (verb === "enable" ? "enabled" : "disabled"));
};
var _ = yargs.command("start", "Start server", function () {
    command_service_1.commandService.start().catch(function (error) {
        log.add({ type: log_module_1.logType.ERROR, title: "Error when starting server", message: error.message, data: { error: error } });
        process.exit();
    });
}).command("init", "Initiate config file", function () {
    command_service_1.commandService.init().then(function (configPath) {
        log.add("SSME config created at: \"" + configPath + "\"");
    }).catch(function (error) {
        log.add({ type: log_module_1.logType.ERROR, title: "Error when initiating config file", message: error.message, data: { error: error } });
    }).finally(function () { return process.exit(); });
}).command("list", "List available hosts", function () {
    var hostsPath = config_service_1.configService.attributes.hostsPath;
    console.table(fs.readdirSync(hostsPath).filter(function (file) { return file.match(/^.+\.json$/); })
        .map(function (file) {
        var data = JSON.parse(fs.readFileSync(path.resolve(hostsPath, file), "utf8"));
        return {
            "Domain": data.domain,
            "Target": data.target,
            "Enable": data.enable,
            "HTTPS": !!data.security,
            "Redirect HTTPS": data.security ? !!data.redirectToHttps : "-",
            "Cert Expires": data.security ? (function () {
                var certData = Certificate.fromPEM(fs.readFileSync(data.security.cert));
                return helper_service_1.helperService.dateTimeToString(certData.validTo);
            })() : "-",
        };
    }));
    process.exit();
}).command("create <domain> <target> [exec]", "Create new host", function (yargs) {
    yargs.positional("domain", { describe: "Domain to listen on" });
    yargs.positional("target", { describe: "Target host or path" });
    yargs.positional("exec", { describe: "Executable script to run on start", default: undefined });
}, function (argv) {
    command_service_1.commandService.create(argv.domain, argv.target, argv.exec).then(function () {
        log.add("Host \"" + argv.domain + "\" with target \"" + argv.target + "\" was created");
    }).catch(function (error) {
        log.add({ type: log_module_1.logType.ERROR, title: "Error when creating host", message: error.message, data: { error: error } });
    }).finally(function () { return process.exit(); });
}).command("enable <domain>", "Enable host", function (yargs) {
    yargs.positional("domain", { describe: "Domain to enable" });
}, function (argv) {
    command_service_1.commandService.enableDisable("enable", argv.domain).then(function (status) {
        log.add("Host \"" + argv.domain + "\" was " + status);
    }).catch(function (error) {
        log.add({ type: log_module_1.logType.ERROR, title: "Error when enabling host", message: error.message, data: { error: error } });
    }).finally(function () { return process.exit(); });
}).command("disable <domain>", "Disable host", function (yargs) {
    yargs.positional("domain", { describe: "Domain to disable" });
}, function (argv) {
    command_service_1.commandService.enableDisable("disable", argv.domain).then(function (status) {
        log.add("Host \"" + argv.domain + "\" was " + status);
    }).catch(function (error) {
        log.add({ type: log_module_1.logType.ERROR, title: "Error when enabling host", message: error.message, data: { error: error } });
    }).finally(function () { return process.exit(); });
}).command("certify <domain>", "Create certificate for domain using letsencrypt certbot", function (yargs) {
    yargs.positional("domain", { describe: "Domain to certify" });
}, function (argv) {
    command_service_1.commandService.certify(argv.domain).then(function () {
        log.add("Certificate for \"" + argv.domain + "\" was created");
    }).catch(function (error) {
        log.add({ type: log_module_1.logType.ERROR, title: "Error when creating certificate", message: error.message, data: { error: error } });
    }).finally(function () { return process.exit(); });
}).command("auth", "Authenticate domain (use with certbot)", function (yargs) {
    yargs.option("d", __assign({ alias: "domain" }, (process.env.CERTBOT_DOMAIN === undefined ? { demand: "Please specify domain" } : undefined), { describe: "Domain to authenticate", default: process.env.CERTBOT_DOMAIN }));
    yargs.option("t", __assign({ alias: "token" }, (process.env.CERTBOT_TOKEN === undefined ? { demand: "Please specify token" } : undefined), { describe: "Validation token", default: process.env.CERTBOT_TOKEN }));
    yargs.option("v", __assign({ alias: "validation" }, (process.env.CERTBOT_VALIDATION === undefined ? { demand: "Please specify validation" } : undefined), { describe: "Validation string", default: process.env.CERTBOT_VALIDATION }));
}, function (argv) {
    command_service_1.commandService.auth(argv.domain, argv.token, argv.validation).then(function () {
        log.add("Authentication for \"" + argv.domain + "\" was successful");
    }).catch(function (error) {
        log.add({ type: log_module_1.logType.ERROR, title: "Error when authentication domain", message: error.message, data: { error: error } });
    }).finally(function () { return process.exit(); });
}).command("cleanup", "Authentication cleanup for domain (use with certbot)", function (yargs) {
    yargs.option("d", __assign({ alias: "domain" }, (process.env.CERTBOT_DOMAIN === undefined ? { demand: "Please specify domain" } : undefined), { describe: "Domain to authenticate", default: process.env.CERTBOT_DOMAIN }));
}, function (argv) {
    command_service_1.commandService.cleanup(argv.domain).then(function () {
        log.add("Authentication cleanup for \"" + argv.domain + "\" was successful");
    }).catch(function (error) {
        log.add({ type: log_module_1.logType.ERROR, title: "Error when authentication cleanup", message: error.message, data: { error: error } });
    }).finally(function () { return process.exit(); });
}).demandCommand().argv;
