"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ServiceModule = (function () {
    function ServiceModule() {
    }
    Object.defineProperty(ServiceModule, "instance", {
        get: function () {
            return this._instance !== undefined ? this._instance : new this();
        },
        enumerable: true,
        configurable: true
    });
    ServiceModule.getInstance = function () {
        return this.instance;
    };
    return ServiceModule;
}());
exports.ServiceModule = ServiceModule;
