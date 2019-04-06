import * as express from "express";
import * as httpProxyMiddleware from "http-proxy-middleware";
import * as vhost from "vhost";
import * as https from "https";
import * as tls from "tls";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as commandLineArgs from "command-line-args";
import { envService } from "./services/env.service";
import { LogModule, logType } from "./modules/log.module";
import { helperService } from "./services/helper.service";
const x509 = require("x509");

interface IHost {
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

// host folder
const hostsPath: string = envService.get("HOSTS_PATH", path.resolve(os.homedir(), ".ssme"));

const optionDefinitions = [
  { name: "create", type: Boolean },
  { name: "domain", type: String }, // Part of create command
  { name: "target", type: String }, // Part of create command
  { name: "list", type: Boolean },
  { name: "enable", type: Boolean },
  { name: "disable", type: Boolean },
  { name: "auth", alias: "v", type: Boolean },
  { name: "cleanup", alias: "c", type: Boolean }
]
const options = commandLineArgs(optionDefinitions);

if (options.create) {
  let log = new LogModule();
  if (options.domain === undefined || options.target == undefined) {
    log.add({ title: "Could not create new config", message: "Domain and/or target argument are missing", type: logType.ERROR });
    process.exit();
  }
  const hostFilePath = path.resolve(hostsPath, `${options.domain}.json`);
  const host: IHost = {
    domain: options.domain,
    target: options.target,
    enable: true
  };

  fs.writeFileSync(hostFilePath, JSON.stringify(host, null, 4), "utf8");

  // Since hosts were to be created end script here
  process.exit();
}

if (options.list) {
  const files = fs.readdirSync(hostsPath).filter((file: string) => file.match(/^.+\.json$/));

  let message: string = "\nListing all available configs\n-----------------------------\n";
  files.forEach((file: string) => {
    const data: IHost = JSON.parse(fs.readFileSync(path.resolve(hostsPath, file), "utf8"));
    message +=
      `\nDomain: ${data.domain}` +
      `\nTarget: ${data.target}` +
      `\nEnable: ${data.enable ? "true" : "false"}` +
      `\nHTTPS: ${data.security ? "true" : "false"}` +
      `\nRedirect HTTPS: ${data.security ? `${data.redirectToHttps ? "true" : "false"}` : "-"}` +
      (data.security ? (() => {
        const certData = x509.parseCert(data.security.cert);

        return `\nCert Expires: ${helperService.dateTimeToString(certData.notAfter as Date)}`;
      })() : "") +
      `\n------------------------------\n`;
  })

  console.log(message);
  process.exit();
}

if (options.enable || options.disable) {
  let log = new LogModule();

  if (options.domain === undefined) {
    log.add({ title: "No domain specified", message: "You need to specify domain", type: logType.ERROR });
    process.exit();
  }
  try {
    // Get host data
    const hostFilePath = path.resolve(hostsPath, `${options.domain}.json`);
    const host: IHost = JSON.parse(fs.readFileSync(hostFilePath, "utf8"));

    // Set host enable status
    host.enable = options.enable !== undefined;

    // Write host file
    fs.writeFileSync(hostFilePath, JSON.stringify(host, null, 4), "utf8");
  } catch (error) {
    log.add({ title: "Failed to enable domain", message: `Domain "${options.domain}" failed to be enabled`, type: logType.ERROR, data: error });
  }

  process.exit();
}

if (options.auth || options.cleanup) {
  const hostFilePath = path.resolve(hostsPath, `${process.env.CERTBOT_DOMAIN}.json`);
  const host: IHost = JSON.parse(fs.readFileSync(hostFilePath, "utf8"));

  if (options.auth) {
    host.letsEncryptAuth = {
      token: process.env.CERTBOT_TOKEN,
      validation: process.env.CERTBOT_VALIDATION,
    }
  }

  if (options.cleanup) {
    // Removes auth
    host.letsEncryptAuth = undefined;

    // Adds certificate
    host.security = {
      cert: `/etc/letsencrypt/live/${process.env.CERTBOT_DOMAIN}/cert.pem`,
      key: `/etc/letsencrypt/live/${process.env.CERTBOT_DOMAIN}/privkey.pem`,
      ca: `/etc/letsencrypt/live/${process.env.CERTBOT_DOMAIN}/chain.pem`
    }

    // Sets to auto redirect to https
    host.redirectToHttps = true;
  }

  // Write host file
  fs.writeFileSync(hostFilePath, JSON.stringify(host, null, 4), "utf8");

  // Since hosts were to be rewritten end script here
  process.exit();
}

// Log module
const log = new LogModule("ssme");

if (os.userInfo().username !== "root") {
  log.add({ title: "Not running as root", message: "Server can only be run as root. Process will end", type: logType.ERROR });
  process.exit();
}

// Make sure host folder exists
if (!fs.existsSync(hostsPath)) {
  // Create directory
  fs.mkdirSync(hostsPath);

  // Get user home dir stats
  const homedirStats = fs.statSync(os.homedir());

  // Set hosts path ownership to homedir user ()
  fs.chownSync(hostsPath, homedirStats.uid, homedirStats.gid);
}

// Creating app
const rootApp: express.Express = express();

// Listening on port 80
const port = parseInt(envService.get("PORT", "80"));
const sslPort = parseInt(envService.get("SSL_PORT", "433"));
rootApp.listen(port, () => {
  log.add(`Listening on port ${port}`);
  https.createServer({
    key: "", cert: "", ca: "",
    SNICallback: (domain: string, callback: (error: Error | null, ctx: tls.SecureContext) => void) => {
      if (certFiles[domain] !== undefined) {
        callback(null, tls.createSecureContext(certFiles[domain]));
      } else {
        callback(null, tls.createSecureContext({ cert: "", key: "", ca: "", }));
      }
    },
  }, rootApp).listen(sslPort, () => {
    log.add(`listening on port ${sslPort}`);
    loadHosts(rootApp);
  });

});

let certFiles: { [key: string]: security } = {};

// Setup watcher for hosts
fs.watch(hostsPath, (event: string, filename: string) => {
  log.add({ title: "Configs updated", message: "Config files were edited. Reloading" });
  loadHosts(rootApp);
});

const loadHosts = (app: express.Express): void => {

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
    log.add({ title: "config parse error", message: "Error while parsing host files", type: logType.ERROR, data: error })
    return;
  }

  // Check host attributes
  for (let host of hosts) {
    if (host.domain === undefined || host.target === undefined) {
      log.add({ title: "Missing config attributes", message: `missing either domain or target in config "${(host as any).filename}"`, type: logType.WARNING });
    }
  }

  if (hosts.length === 0) {
    log.add({ title: "Empty config list", message: "No configs were loaded" });
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
      let vhostApp = express();

      if (host.letsEncryptAuth) {
        // Adds route for lets encrypt validation
        vhostApp.get(`/.well-known/acme-challenge/${host.letsEncryptAuth.token}`, (request: express.Request, response: express.Response, next: express.NextFunction) => {
          response.send(host.letsEncryptAuth.validation);
        });
      }

      if (host.security !== undefined) {
        certFiles[host.domain] = {
          key: fs.readFileSync(host.security.key, "utf8"),
          cert: fs.readFileSync(host.security.cert, "utf8"),
          ca: fs.readFileSync(host.security.ca, "utf8"),
        }

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

        log.add({ title: "Serve", message: `Serving proxy "${host.domain}" to "${host.target}"` });
      } else {
        // Sets up static path
        const staticPath = path.resolve(host.target);
        vhostApp.use(express.static(staticPath));
        vhostApp.get("*", (request: express.Request, response: express.Response) => {
          response.sendFile("index.html", { root: staticPath });
        });

        log.add({ title: "Serve", message: `Serving static content for ${host.domain} from path: ${staticPath}` });
      }

      app.use(vhost(host.domain, vhostApp));
    });
  } catch (error) {
    log.add({ title: "Webserver error", message: "Loading hosts to webserver somehow failed", type: logType.ERROR, data: error });
  }
}