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
var service_module_1 = require("../modules/service.module");
var HelperService = (function (_super) {
    __extends(HelperService, _super);
    function HelperService() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    HelperService.prototype.padStart = function (string, pad, fill) {
        if (fill === void 0) { fill = " "; }
        return "" + fill.repeat(Math.max(0, pad - string.length)) + string;
    };
    HelperService.prototype.dateTimeToString = function (date) {
        if (typeof date === "string") {
            date = new Date(date);
        }
        return date.getFullYear() + "-" + this.padStart(date.getMonth().toString(), 2, "0") + "-" + this.padStart(date.getDate().toString(), 2, "0")
            + (" " + this.padStart(date.getHours().toString(), 2, "0") + ":" + this.padStart(date.getMinutes().toString(), 2, "0") + ":" + this.padStart(date.getSeconds().toString(), 2, "0"));
    };
    return HelperService;
}(service_module_1.ServiceModule));
exports.HelperService = HelperService;
exports.helperService = HelperService.getInstance();
