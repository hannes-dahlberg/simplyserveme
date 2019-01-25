import * as express from "express";
import * as httpProxyMiddleware from "http-proxy-middleware";
import * as vhost from "vhost";
import * as https from "https";
import * as tls from "tls";
import * as fs from "fs";

// Creating app
const rootApp: express.Express = express();

// Listening on port 80
rootApp.listen(80, () => {
  console.log("Listening on port 80");
  loadConfigs(rootApp);
});

let certFiles: { [key: string]: { key: string, cert: string } } = {};

var httpsServer = https.createServer({
  SNICallback: (domain: string, callback) => {
    if (certFiles[domain] !== undefined) {
      callback(null, tls.createSecureContext(certFiles[domain]));
    } else {
      callback(null, tls.createSecureContext({
        cert: "",
        key: ""
      }));
    }
  },
  key: "",
  cert: "",
}, this.app).listen(443, () => {
  console.log("listening on port 433");
});

// Setup watcher for configs
fs.watch("./configs", (event: string, filename: string) => {
  console.log("Configs were edited, reload configs");
  loadConfigs(rootApp);
});

interface Iconfig {
  domain: string; // Doman
  target: string; // Target address (none https),
  security?: {
    key: string,
    cert: string
  }
}

const loadConfigs = (app: express.Express): void => {

  // Container for configs
  let configs: Iconfig[];

  // Try reading config folder
  try {
    configs = fs.readdirSync("./configs")
      .filter((config: string) => config.match(/.+\.json$/))
      .map((config: string) => ({
        // Parse each config file and add filename
        ...JSON.parse(fs.readFileSync(`./configs/${config}`, "utf8")),
        filename: config
      }));
  } catch (error) {
    console.log("Error while parsing config files", error);
    return;
  }

  // Check config attributes
  try {
    configs.forEach((config: Iconfig) => {
      if (config.domain === undefined || config.target === undefined) {
        throw new Error();
      }
    })
  } catch (error) {
    configs = undefined;
    console.log("missing either domain, target, key or cert in config");
  }

  if (configs === undefined) {
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

  // Add each config as a vhost app to app server
  try {
    configs.forEach((config: Iconfig) => {
      app.use(vhost(config.domain, express().use("/", httpProxyMiddleware({ target: config.target, changeOrigin: true }))));
      if (config.security !== undefined) {
        certFiles[config.domain] = {
          key: fs.readFileSync(config.security.key, "utf8"),
          cert: fs.readFileSync(config.security.cert, "utf8"),
        }
      }
    });
  } catch (error) {
    console.log("Loading configs to webserver somehow failed", error);
  }
}