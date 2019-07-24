import * as childProcess from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { ServiceModule } from "..";
import { configService, defaultConfig } from "./config.service";
import { IHost, server } from "./server.service";

export class CommandService extends ServiceModule {
  public start(): Promise<void> {
    return server.start();
  }
  public init(): Promise<string> {
    return new Promise((resolve, reject) => {
      const configPath = path.resolve("./", "ssme.config.json");
      fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 4), { flag: "wx", encoding: "utf8" }, (error: any) => {
        if (error && error.code === "EEXIST") {
          reject(new Error((`Config file already exists at: "${configPath}". Will not overwrite.`)));
        } else if (error) {
          reject(new Error(`Failed to create config path at: "${configPath}"`));
        } else {
          // reject(new Error(`SSME config created at: "${configPath}"`));
          resolve(configPath);
        }
      });
    });
  }
  public create(domain: string, target: string, exec?: string) {
    return new Promise((resolve, reject) => {
      const host: IHost = {
        domain,
        target,
        ...(exec !== undefined ? { exec } : undefined),
        enable: true,
        whiteListIps: ["127.0.0.1"],
      };

      this.saveHostFile(domain, host).then(() => resolve()).catch((error: any) => reject(error));
    });
  }
  public enableDisable(verb: "enable" | "disable", domain: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Get host data
      this.getHostFile(domain).then((host: IHost) => {
        // Set host enable status
        host.enable = verb === "enable";
        this.saveHostFile(domain, host)
          .then(() => resolve(verb === "enable" ? "enabled" : "disabled"))
          .catch((error: any) => reject(error));
      }).catch((error) => reject(error));
    });
  }
  public certify(domain: string): Promise<void> {
    return new Promise((resolve, reject) => {
      childProcess.exec(`certbot certonly
      --manual
      -d "${domain}"
      --manual-public-ip-logging-ok
      --register-unsafely-without-email
      --agree-tos
      --manual-auth-hook "ssme auth"
      --manual-cleanup-hook "ssme cleanup"
    --config-dir ${os.homedir()}/.letsencrypt/config
    --work-dir ${os.homedir()}/.letsencrypt/work
    --logs-dir ${os.homedir()}/.letsencrypt/logs`, (error: any) => {
          if (error) { reject(error); }
          resolve();
        });
    });
  }
  public auth(domain: string, token: string, validation: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get host data
      this.getHostFile(domain).then((host: IHost) => {
        // Sets auth for Lets Encrypt
        host.letsEncryptAuth = {
          token,
          validation,
        };
        this.saveHostFile(domain, host)
          .then(() => resolve())
          .catch((error: any) => reject(error));
      }).catch((error) => reject(error));
    });
  }
  public cleanup(domain: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get host data
      this.getHostFile(domain).then((host: IHost) => {
        // Removes auth
        host.letsEncryptAuth = undefined;

        // Adds certificate
        host.security = {
          cert: `${os.homedir()}/.letsencrypt/config/live/${domain}/cert.pem`,
          key: `${os.homedir()}/.letsencrypt/config/live/${domain}/privkey.pem`,
          ca: `${os.homedir()}/.letsencrypt/config/live/${domain}/chain.pem`,
        };

        // Sets to auto redirect to https
        host.redirectToHttps = true;

        this.saveHostFile(domain, host)
          .then(() => resolve())
          .catch((error: any) => reject(error));
      }).catch((error) => reject(error));
    });
  }
  private getHostFile(domain: string): Promise<IHost> {
    return new Promise((resolve, reject) => {
      try {
        resolve(JSON.parse(fs.readFileSync(this.getHostFilePath(domain), "utf8")));
      } catch (error) { reject(error); }
    });
  }
  private saveHostFile(domain: string, data: IHost): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        fs.writeFileSync(this.getHostFilePath(domain), JSON.stringify(data, null, 4), "utf8");
        resolve();
      } catch (error) { reject(error); }
    });
  }
  private getHostFilePath(domain: string): string {
    return path.resolve(configService.attributes.hostsPath, `${domain}.json`);
  }
}

export const commandService: CommandService = CommandService.getInstance<CommandService>();
