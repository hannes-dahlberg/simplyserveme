import * as express from "express";
import * as httpProxyMiddleware from "http-proxy-middleware";
import * as vhost from "vhost";
import * as http from "http";
import * as https from "https";
import * as net from "net";
import * as tls from "tls";
import * as fs from "fs";
import * as path from "path";

import { configService, IConfig } from "./config.service";
import { LogModule, logType } from "../modules/log.module";
import { ServiceModule } from "../modules/service.module";
export { Server } from "../modules/server.module";

export interface IHost {
  domain: string; // Domain
  target: string; // Target address (none https),
  enable: boolean;
  security?: security,
  redirectToHttps?: boolean,
  letsEncryptAuth?: {
    validation: string,
    token: string
  }
}
type security = { key: string, cert: string, ca: string, };
type certFiles = { [key: string]: security };
enum serverState {
  STARTED = "started",
  STARTING = "starting",
  STOPPING = "stopping",
  STOPPED = "stopped",
}

class ServerService extends ServiceModule {
  private _state: serverState = serverState.STOPPED;

  private _servers: net.Server[] = [];
  private _connections: net.Socket[] = [];

  private hostWatcher: fs.FSWatcher;

  private certFiles: certFiles = {};
  private configs: IConfig = configService.attributes;
  private log: LogModule = new LogModule(this.configs.logOutputConsole, this.logPath);;

  private get logPath(): string {
    return path.resolve(this.configs.logDumpPath, "server.log");
  }

  public constructor(
    private app: express.Express = express(),
  ) {
    super();

    // Whenever configs are reloaded. Restart the server
    configService.on("reload", () => {
      this.log.add({ title: "Server", message: "Server config changes detected" });


      if (this.configs.logOutputConsole && !configService.attributes.logOutputConsole) {
        console.log("Console log was turned of by server config. No more messages will be displayed")
      }

      // Resets configs
      this.configs = configService.attributes;

      // Recreate log using configs
      this.log = new LogModule(this.configs.logOutputConsole, this.logPath);

      this.restart();
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._state = serverState.STARTING;

      // Setup watcher for watching config file changes
      this.hostWatcher = fs.watch(this.configs.hostsPath, () => {
        this.log.add({ title: "Hosts", message: "Detecting host file changes. Updating..." })
        this.loadHosts(this.app, this.configs.hostsPath);
      });

      const connectionEventHandler = (server: net.Server) => {
        // Listener for connections
        server.on("connect", (connection: tls.TLSSocket) => {
          // Add to array of connections
          this._connections.push(connection);
          // Remove from array if closed
          connection.on("close", () => this._connections = this._connections.filter((connectionRef: net.Socket) => connectionRef !== connection));
        });
      };

      // Create HTTP Server
      const httpServer = this.app.listen(this.configs.port, () => {
        this.log.add(`HTTP Server created listening on port ${this.configs.port}`);

        // Create HTTPS Server
        const httpsServer = https.createServer({
          key: "", cert: "", ca: "",
          // Callback for certificate calls
          SNICallback: (domain: string, callback: (error: Error | null, ctx: tls.SecureContext) => void) => {
            //Depending on domain respond with different certificate
            if (this.certFiles[domain] !== undefined) {
              callback(null, tls.createSecureContext(this.certFiles[domain]));
            } else {
              callback(null, tls.createSecureContext({ cert: "", key: "", ca: "", }));
            }
          },
        }, this.app).listen(this.configs.sslPort, () => {
          this._state = serverState.STARTED;
          this.log.add(`HTTPS Server created listening on port ${this.configs.sslPort}`);
          this.loadHosts(this.app, configService.attributes.hostsPath);
          this.log.add({ title: "Server", message: "Server started" });
          resolve();
        });

        // Set up connection event handlers for server
        connectionEventHandler(httpServer);
        connectionEventHandler(httpsServer);

        // Add servers to array of servers
        this._servers.push(httpServer, httpsServer);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._state = serverState.STOPPING;
      // Close host file watcher
      this.hostWatcher.close();

      // End connections
      this.endConnections().then(() => this.closeServers().then(() => {
        this._state = serverState.STOPPED;
        this.log.add({ title: "Server", message: "Server stopped" });
        resolve();
      }));
    });
  }

  private endConnections(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Resolve if connection list is empty
      if (this._connections.length === 0) { resolve(); return; }

      // End each connection
      this._connections.forEach(connection => connection.end("", "", () => {
        // Remove connection from array
        this._connections = this._connections = this._connections.filter((connectionRef: net.Socket) => connectionRef !== connection);
        // Check if array is empty, if so resolve
        if (this._connections.length === 0) { resolve(); }
      }));

      // Timeout to instead destroy all connections
      setTimeout(() => {
        this._connections.forEach(connection => connection.destroy());
        resolve();
      }, 5000);
    });
  }

  private closeServers(): Promise<void> {
    return new Promise((resolve, reject) => {
      let hasResolved: boolean = false;

      // Resolve if server list is empty
      if (this._servers.length === 0) { resolve(); return; }

      // End each server
      this._servers.forEach(server => server.close(() => {
        // Remove connection from array
        this._servers = this._servers = this._servers.filter((serverRef: net.Server) => serverRef !== server);
        // Check if array is empty, if so resolve
        if (this._servers.length === 0) {
          if (!hasResolved) {
            resolve();
            hasResolved = true;
          }
        }
      }));

      // Timeout to instead remove all servers
      setTimeout(() => {
        if (!hasResolved) {
          this._servers = [];
          resolve();
          hasResolved = true;
        }
      }, 1000);

    })
  }

  public restart() {
    // Make sure to restart only an actual running server
    if (this._state !== serverState.STARTED) { return; }

    this.log.add({ title: "Server", message: "Restarting server..." })

    // Call to shutdown server
    this.log.add({ title: "Server", message: "Stopping server..." });
    this.stop().then(() => {
      // After shutdown start server again
      this.log.add({ title: "Server", message: "Starting server..." });
      this.start().catch((error: any) => {
        this.log.add({ title: "Server", message: "Server failed to start", type: logType.ERROR, data: { error } });
      });
    }).catch((error: any) => {
      this.log.add({ title: "Server", message: "Server failed to shutdown", type: logType.ERROR, data: { error } });
    });
  }

  private loadHosts(app: express.Express, hostsPath: string): void {
    this.log.add({ title: "Host", message: "loading host configs..." });

    // Clear cert files
    this.certFiles = {};

    // Container for hosts
    let hosts: IHost[] = [];

    // Try reading host folder
    try {
      hosts = fs.readdirSync(hostsPath)
        .filter((host: string) => host.match(/.+\.json$/))
        .map((host: string) => ({
          // Parse each host file and add filename
          ...JSON.parse(fs.readFileSync(path.resolve(hostsPath, host), "utf8")),
          filename: host
        }));
    } catch (error) {
      this.log.add({ title: "config parse error", message: "Error while parsing host files", type: logType.ERROR, data: error })
      return;
    }

    // Check host attributes
    for (let host of hosts) {
      if (host.domain === undefined || host.target === undefined) {
        this.log.add({ title: "Missing config attributes", message: `missing either domain or target in config "${(host as any).filename}"`, type: logType.WARNING });
      }
    }

    // Log if no host files were found
    if (hosts.length === 0) {
      this.log.add({ title: "Empty config list", message: "No configs were loaded" });
      return;
    }

    // clean up old vhost apps
    if (app._router !== undefined) {
      let vhostIndex: number;
      do {
        vhostIndex = app._router.stack.findIndex((stackItem: any) => stackItem.name === "vhost");
        app._router.stack.splice(vhostIndex, 1);
      } while (vhostIndex != -1)
    }

    // Add each host as a vhost app to app server
    try {
      hosts.filter((host: IHost) => host.enable).forEach((host: IHost) => {
        // Create vhost App
        let vhostApp = express();

        // Look for encrypion configs
        if (host.letsEncryptAuth) {
          // Adds route for lets encrypt validation
          vhostApp.get(`/.well-known/acme-challenge/${host.letsEncryptAuth.token}`, (request: express.Request, response: express.Response, next: express.NextFunction) => {
            response.send(host.letsEncryptAuth.validation);
          });
        }

        // Read cert files
        if (host.security !== undefined) {
          this.certFiles[host.domain] = {
            key: fs.readFileSync(host.security.key, "utf8"),
            cert: fs.readFileSync(host.security.cert, "utf8"),
            ca: fs.readFileSync(host.security.ca, "utf8"),
          }

          // Create redirect to https
          if (host.redirectToHttps) {
            vhostApp.get('*', (request: express.Request, response: express.Response, next: express.NextFunction) => {
              if (request.protocol === "http") { response.redirect(`https://${request.headers.host}${request.url}`); return; }
              next();
            });
          }
        }

        // If target is web url
        if (!!host.target.match(/^http/)) {
          // Sets up proxy
          vhostApp.use("/", httpProxyMiddleware({ target: host.target, changeOrigin: true, logLevel: "silent" }));

          this.log.add({ title: "Serve", message: `Serving proxy "${host.domain}" to "${host.target}"` });
        } else {
          // Sets up static path
          const staticPath = path.resolve(host.target);
          vhostApp.use(express.static(staticPath));
          vhostApp.get("*", (request: express.Request, response: express.Response) => {
            response.sendFile("index.html", { root: staticPath });
          });

          this.log.add({ title: "Serve", message: `Serving static content for ${host.domain} from path: ${staticPath}` });
        }

        // Add vhost to app
        app.use(vhost(host.domain, vhostApp));
      });
    } catch (error) {
      this.log.add({ title: "Webserver error", message: "Loading hosts to webserver somehow failed", type: logType.ERROR, data: error });
    }
  }
}

export const server = new ServerService();