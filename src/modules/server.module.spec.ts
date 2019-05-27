import { expect } from "chai";
import * as http from "http";
import * as net from "net";
import { Server } from "./server.module";

describe("Server", () => {
  describe("constructor()", () => {
    it("Should be able to create a new server", () => {
      // 1. Arrange
      const MinimumNumberOfApps = 1;

      // 2. Act
      const server = (new Server({
        domain: "www.test.test"
      }) as any);

      // 3. Assert
      expect(server.apps.length).to.greaterThan(MinimumNumberOfApps - 1);
    });
  });
  describe("start()", () => {
    it("Should be able to start a server", (done) => {
      // 1. Arrange
      const expectedPort = Math.floor(Math.random() * 61000) + 32768;

      // 2. Act
      new Server({
        domain: "www.test.test"
      }, expectedPort).start().then((listener: http.Server) => {
        // 3. Assert
        expect((listener.address() as net.AddressInfo).port).to.equal(expectedPort);
        listener.on("close", () => {
          done();
        });
        listener.close();
      });
    });
  });
  describe("createApp()", () => {
    it("Should be able create an app using the vhost lib", () => {
      // 1. Arrange
      const expectedPort = 1234;

      // 2. Act
      const app = (new Server({
        domain: "www.test.test"
      }, expectedPort) as any).createApp({ domain: "test.domain" });

      // 3. Assert
      expect(typeof app).to.equal("function");
    });
  });
});
