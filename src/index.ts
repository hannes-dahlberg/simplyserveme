import * as express from "express";
import * as httpProxyMiddleware from "http-proxy-middleware";
import * as vhost from "vhost";
import * as https from "https";
import * as tls from "tls";
import * as fs from "fs";

// Creating app
const rootApp: express.Express = express();

const rootApp2: express.Express = express();
rootApp2.use((request: express.Request, result: express.Response) => {
  result.send('Hello there !');
});


// Listening on port 80
rootApp.listen(80, () => {
  console.log("Listening on port 80");
  loadConfigs(rootApp);
});

type security = { key: string, cert: string, ca: string, };
let certFiles: { [key: string]: security } = {};

var httpsServer = https.createServer({
  key: "", cert: "", ca: "",
  SNICallback: (domain: string, callback: (error: Error | null, ctx: tls.SecureContext) => void) => {
    if (certFiles[domain] !== undefined) {
      callback(null, tls.createSecureContext(certFiles[domain]));
    } else {
      callback(null, tls.createSecureContext({ cert: "", key: "", ca: "", }));
    }
  },
}, rootApp).listen(443, () => {
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
  security?: security,
  redirectToHttps?: boolean
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
    console.log("missing either domain or target in config");
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
      let vhostApp = express();

      if (config.security !== undefined) {
        certFiles[config.domain] = {
          key: fs.readFileSync(config.security.key, "utf8"),
          cert: fs.readFileSync(config.security.cert, "utf8"),
          ca: fs.readFileSync(config.security.ca, "utf8"),
        }

        if (config.redirectToHttps) {
          vhostApp.get('*', (request: express.Request, response: express.Response, next: express.NextFunction) => {
            if (request.protocol === "http") { response.redirect(`https://${request.headers.host}${request.url}`); return; }
            next();
          });
        }
      }

      vhostApp.use("/", httpProxyMiddleware({ target: config.target, changeOrigin: true }));
      app.use(vhost(config.domain, vhostApp));
    });
  } catch (error) {
    console.log("Loading configs to webserver somehow failed", error);
  }
}