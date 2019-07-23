import * as childProcess from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as yargs from "yargs";
import { LogModule, logType } from "./modules/log.module";
import { commandService } from "./services/command.service";
import { configService, defaultConfig } from "./services/config.service";
import { helperService } from "./services/helper.service";
import { IHost, server } from "./services/server.service";

const cTable = require("console.table"); // tslint:disable-line:no-var-requires
const { Certificate } = require("@fidm/x509"); // tslint:disable-line:no-var-requires

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
};

const _ = yargs.command<{}>("start", "Start server", () => {
  commandService.start().finally(() => {
    process.exit();
  });
}).command<{}>("init", "Initiate config file", () => {
  commandService.init().then((configPath: string) => {
    log.add(`SSME config created at: "${configPath}"`);
  }).catch((error: any) => {
    log.add({ type: logType.ERROR, title: "Error when initiating config file", message: error.message, data: { error } });
  }).finally(() => process.exit());
}).command<{}>("list", "List available hosts", () => {
  const hostsPath = configService.attributes.hostsPath;
  console.table(fs.readdirSync(hostsPath).filter((file: string) => file.match(/^.+\.json$/))
    .map((file: string) => {
      const data = JSON.parse(fs.readFileSync(path.resolve(hostsPath, file), "utf8"));
      return {
        "Domain": data.domain,
        "Target": data.target,
        "Enable": data.enable,
        "HTTPS": !!data.security,
        "Redirect HTTPS": data.security ? !!data.redirectToHttps : "-",
        "Cert Expires": data.security ? (() => {
          const certData = Certificate.fromPEM(fs.readFileSync(data.security.cert));
          return helperService.dateTimeToString(certData.validTo as Date);
        })() : "-",
      };
    }));
  // End Process
  process.exit();
}).command<{}>("create <domain> <target> [exec]", "Create new host", (yargs: yargs.Argv) => {
  yargs.positional("domain", { describe: "Domain to listen on" });
  yargs.positional("target", { describe: "Target host or path" });
  yargs.positional("exec", { describe: "Executable script to run on start", default: undefined });
}, (argv: yargs.Arguments<{ domain: string, target: string, exec?: string }>) => {
  commandService.create(argv.domain, argv.target, argv.exec).then(() => {
    log.add(`Host "${argv.domain}" with target "${argv.target}" was created`);
  }).catch((error: any) => {
    log.add({ type: logType.ERROR, title: "Error when creating host", message: error.message, data: { error } });
  }).finally(() => process.exit());
}).command<{}>("enable <domain>", "Enable host", (yargs: yargs.Argv) => {
  yargs.positional("domain", { describe: "Domain to enable" });
}, (argv: yargs.Arguments<{ domain: string }>) => {
  commandService.enableDisable("enable", argv.domain).then((status: string) => {
    log.add(`Host "${argv.domain}" was ${status}`);
  }).catch((error) => {
    log.add({ type: logType.ERROR, title: "Error when enabling host", message: error.message, data: { error } });
  }).finally(() => process.exit());
}).command<{}>("disable <domain>", "Disable host", (yargs: yargs.Argv) => {
  yargs.positional("domain", { describe: "Domain to disable" });
}, (argv: yargs.Arguments<{ domain: string }>) => {
  commandService.enableDisable("disable", argv.domain).then((status: string) => {
    log.add(`Host "${argv.domain}" was ${status}`);
  }).catch((error) => {
    log.add({ type: logType.ERROR, title: "Error when enabling host", message: error.message, data: { error } });
  }).finally(() => process.exit());
}).command<{}>("certify <domain>", "Create certificate for domain using letsencrypt certbot", (yargs: yargs.Argv) => {
  yargs.positional("domain", { describe: "Domain to certify" });
}, (argv: yargs.Arguments<{ domain: string }>) => {
  commandService.certify(argv.domain).then(() => {
    log.add(`Certificate for "${argv.domain}" was created`);
  }).catch((error: any) => {
    log.add({ type: logType.ERROR, title: "Error when creating certificate", message: error.message, data: { error } });
  }).finally(() => process.exit());
}).command<{}>("auth", "Authenticate domain (use with certbot)", (yargs: yargs.Argv) => {
  yargs.option("d", { alias: "domain", ...(process.env.CERTBOT_DOMAIN === undefined ? { demand: "Please specify domain" } : undefined), describe: "Domain to authenticate", default: process.env.CERTBOT_DOMAIN });
  yargs.option("t", { alias: "token", ...(process.env.CERTBOT_TOKEN === undefined ? { demand: "Please specify token" } : undefined), describe: "Validation token", default: process.env.CERTBOT_TOKEN });
  yargs.option("v", { alias: "validation", ...(process.env.CERTBOT_VALIDATION === undefined ? { demand: "Please specify validation" } : undefined), describe: "Validation string", default: process.env.CERTBOT_VALIDATION });
}, (argv: yargs.Arguments<{ domain: string, token: string, validation: string }>) => {
  commandService.auth(argv.domain, argv.token, argv.validation).then(() => {
    log.add(`Authentication for "${argv.domain}" was successful`);
  }).catch((error: any) => {
    log.add({ type: logType.ERROR, title: "Error when authentication domain", message: error.message, data: { error } });
  }).finally(() => process.exit());
}).command<{}>("cleanup", "Authentication cleanup for domain (use with certbot)", (yargs: yargs.Argv) => {
  yargs.option("d", { alias: "domain", ...(process.env.CERTBOT_DOMAIN === undefined ? { demand: "Please specify domain" } : undefined), describe: "Domain to authenticate", default: process.env.CERTBOT_DOMAIN });
}, (argv: yargs.Arguments<{ domain: string }>) => {
  commandService.cleanup(argv.domain).then(() => {
    log.add(`Authentication cleanup for "${argv.domain}" was successful`);
  }).catch((error: any) => {
    log.add({ type: logType.ERROR, title: "Error when authentication cleanup", message: error.message, data: { error } });
  }).finally(() => process.exit());
}).demandCommand().argv;
