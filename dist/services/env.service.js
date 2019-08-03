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
var dotenv = require("dotenv");
var service_module_1 = require("../modules/service.module");
dotenv.config();
var EnvService = (function (_super) {
    __extends(EnvService, _super);
    function EnvService() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    EnvService.prototype.get = function (name, defaultValue) {
        return process.env[name] || defaultValue;
    };
    return EnvService;
}(service_module_1.ServiceModule));
exports.EnvService = EnvService;
exports.envService = EnvService.getInstance();
