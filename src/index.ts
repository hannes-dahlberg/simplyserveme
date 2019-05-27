import * as fs from "fs";
import * as path from "path";
import * as yargs from "yargs";
import { configService, defaultConfig } from "./services/config.service";
import { LogModule } from "./modules/log.module";
import { server, IHost } from "./services/server.service";
import { helperService } from "./services/helper.service";
const cTable = require('console.table');
const x509 = require("x509");

const log = new LogModule();

const enableDisable = (verb: "enable" | "disable", domain: string) => {
  // Get host data
  const hostFilePath = path.resolve(configService.attributes.hostsPath, `${domain}.json`);
  const host: IHost = JSON.parse(fs.readFileSync(hostFilePath, "utf8"));

  // Set host enable status
  host.enable = verb === "enable";

  // Write host file
  fs.writeFileSync(hostFilePath, JSON.stringify(host, null, 4), "utf8");

  log.add(`Host "${host.domain}" was ${verb === "enable" ? "enabled" : "disabled"}`);
}

yargs.command<{}>("start", "Start server", () => {
  server.start();
}).command<{}>("init", "Initiate config file", () => {
  const configPath = path.resolve("./", "ssme.config.json");
  fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 4), { flag: "wx", encoding: "utf8" }, (error: any) => {
    if (error && error.code === "EEXIST") {
      console.log(`Config file already exists at: "${configPath}". Will not overwrite.`);
    } else if (error) {
      console.log(`Failed to create config path at: "${configPath}"`, error);
    } else {
      console.log(`SSME config created at: "${configPath}"`);
    }

    // End Process
    process.exit();
  });
}).command<{}>("list", "List available hosts", () => {
  const hostsPath = configService.attributes.hostsPath;
  console.table(fs.readdirSync(hostsPath).filter((file: string) => file.match(/^.+\.json$/))
    .map((file: string) => {
      const data = JSON.parse(fs.readFileSync(path.resolve(hostsPath, file), "utf8"));
      return {
        Domain: data.domain,
        Target: data.target,
        Enable: data.enable,
        HTTPS: !!data.security,
        "Redirect HTTPS": data.security ? !!data.redirectToHttps : "-",
        "Cert Expires": data.security ? (() => {
          const certData = x509.parseCert(data.security.cert);
          return helperService.dateTimeToString(certData.notAfter as Date);
        })() : "-"
      }
    }));
  // End Process
  process.exit();
}).command<{}>("create <domain> <target>", "Create new host", (yargs: yargs.Argv) => {
  yargs.positional("domain", { describe: "Domain to listen on" });
  yargs.positional("target", { describe: "Target host or path" });
}, (argv: yargs.Arguments<{ domain: string, target: string }>) => {
  const host: IHost = {
    domain: (argv.domain as string),
    target: argv.target,
    enable: true
  };

  const hostFilePath = path.resolve(configService.attributes.hostsPath, `${argv.domain}.json`);
  fs.writeFileSync(hostFilePath, JSON.stringify(host, null, 4), "utf8");

  log.add(`Host "${argv.domain}" with target "${argv.target}" was created`);

  // End Process
  process.exit();
}).command<{}>("enable <domain>", "Enable host", (yargs: yargs.Argv) => {
  yargs.positional("domain", { describe: "Domain to enable" });
}, (argv: yargs.Arguments<{ domain: string }>) => {
  enableDisable("enable", argv.domain);

  // End Process
  process.exit();
}).command<{}>("disable <domain>", "Disable host", (yargs: yargs.Argv) => {
  yargs.positional("domain", { describe: "Domain to disable" });
}, (argv: yargs.Arguments<{ domain: string }>) => {
  enableDisable("disable", argv.domain);

  // End Process
  process.exit();
}).command<{}>("auth", "Authenticate domain (use with certbot)", (yargs: yargs.Argv) => {
  yargs.option("d", { alias: "domain", ...(process.env.CERTBOT_DOMAIN === undefined ? { demand: "Please specify domain" } : undefined), describe: "Domain to authenticate", default: process.env.CERTBOT_DOMAIN });
  yargs.option("t", { alias: "token", ...(process.env.CERTBOT_TOKEN === undefined ? { demand: "Please specify token" } : undefined), describe: "Validation token", default: process.env.CERTBOT_TOKEN });
  yargs.option("v", { alias: "validation", ...(process.env.CERTBOT_VALIDATION === undefined ? { demand: "Please specify validation" } : undefined), describe: "Validation string", default: process.env.CERTBOT_VALIDATION });
}, (argv: yargs.Arguments<{ domain: string, token: string, validation: string }>) => {
  const hostFilePath = path.resolve(configService.attributes.hostsPath, `${argv.domain}.json`);
  const host: IHost = JSON.parse(fs.readFileSync(hostFilePath, "utf8"));

  // Sets auth for Lets Encrypt
  host.letsEncryptAuth = {
    token: argv.token,
    validation: argv.validation,
  }

  // Write host file
  fs.writeFileSync(hostFilePath, JSON.stringify(host, null, 4), "utf8");

  // End Process
  process.exit();
}).command<{}>("cleanup", "Authentication cleanup for domain (use with certbot)", (yargs: yargs.Argv) => {
  yargs.option("d", { alias: "domain", ...(process.env.CERTBOT_DOMAIN === undefined ? { demand: "Please specify domain" } : undefined), describe: "Domain to authenticate", default: process.env.CERTBOT_DOMAIN });
}, (argv: yargs.Arguments<{ domain: string }>) => {
  const hostFilePath = path.resolve(configService.attributes.hostsPath, `${argv.domain}.json`);
  const host: IHost = JSON.parse(fs.readFileSync(hostFilePath, "utf8"));

  // Removes auth
  host.letsEncryptAuth = undefined;

  // Adds certificate
  host.security = {
    cert: `/etc/letsencrypt/live/${argv.domain}/cert.pem`,
    key: `/etc/letsencrypt/live/${argv.domain}/privkey.pem`,
    ca: `/etc/letsencrypt/live/${argv.domain}/chain.pem`
  }

  // Sets to auto redirect to https
  host.redirectToHttps = true;

  // Write host file
  fs.writeFileSync(hostFilePath, JSON.stringify(host, null, 4), "utf8");

  // End Process
  process.exit();
}).demandCommand().argv;