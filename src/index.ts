import * as express from "express";
import * as httpProxyMiddleware from "http-proxy-middleware";
import * as vhost from "vhost";
import * as https from "https";
import * as tls from "tls";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as childProcess from "child_process";

if (os.userInfo().username !== "root") {
  throw new Error("Server can only be run as root");
}

//Config folder
const configPath: string = path.resolve(os.homedir(), ".ssme");

//Make sure config folder exists
if (!fs.existsSync(configPath)) {
  //Create directory
  fs.mkdirSync(configPath);

  //Get user home dir stats
  const homedirStats = fs.statSync(os.homedir());

  //Set config path ownership to homedir user ()
  fs.chownSync(configPath, homedirStats.uid, homedirStats.gid);
}

// Creating app
const rootApp: express.Express = express();

// Listening on port 80
rootApp.listen(80, () => {
  console.log("Listening on port 80");
  https.createServer({
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
    loadConfigs(rootApp);
  });

});

type security = { key: string, cert: string, ca: string, };
let certFiles: { [key: string]: security } = {};

// Setup watcher for configs
fs.watch(configPath, (event: string, filename: string) => {
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
  let configs: Iconfig[] = [];

  // Try reading config folder
  try {
    configs = fs.readdirSync(configPath)
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
    configs = [];
    console.log("missing either domain or target in config");
  }

  if (configs.length === 0) {
    console.log("No configs were loaded");
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