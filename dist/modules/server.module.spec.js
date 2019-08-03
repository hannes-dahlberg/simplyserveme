"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var server_module_1 = require("./server.module");
describe("Server", function () {
    describe("constructor()", function () {
        it("Should be able to create a new server", function () {
            var minimumNumberOfApps = 1;
            var server = new server_module_1.Server({
                domain: "www.test.test",
            });
            chai_1.expect(server.apps.length).to.greaterThan(minimumNumberOfApps - 1);
        });
    });
    describe("start()", function () {
        it("Should be able to start a server", function (done) {
            var expectedPort = Math.floor(Math.random() * 61000) + 32768;
            new server_module_1.Server({
                domain: "www.test.test",
            }, expectedPort).start().then(function (listener) {
                chai_1.expect(listener.address().port).to.equal(expectedPort);
                listener.on("close", function () {
                    done();
                });
                listener.close();
            });
        });
    });
    describe("createApp()", function () {
        it("Should be able create an app using the vhost lib", function () {
            var expectedPort = 1234;
            var app = new server_module_1.Server({
                domain: "www.test.test",
            }, expectedPort).createApp({ domain: "test.domain" });
            chai_1.expect(typeof app).to.equal("function");
        });
    });
});
