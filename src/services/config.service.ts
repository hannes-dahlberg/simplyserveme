import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ServiceModule } from "../modules/service.module";

export type onCallback = (config?: IConfig) => void;
export type onCallbackStore = { verb: string, callback: onCallback };
export type onReturn = { unsubscribe: () => void };

const CONFIG_PATH = path.resolve("./ssme.config.json");

export interface IConfig {
  port: number;
  sslPort: number;
  logOutputConsole: boolean;
  logDumpPath: string;
  hostsPath: string;
}

export const defaultConfig: IConfig = {
  port: 80,
  sslPort: 443,
  logOutputConsole: false,
  logDumpPath: path.resolve(os.homedir(), ".ssme/log"),
  hostsPath: path.resolve(os.homedir(), ".ssme/hosts"),
}

export class ConfigService extends ServiceModule {
  private _attributes: IConfig = defaultConfig;

  public get attributes(): IConfig { return this._attributes; }

  public constructor() {
    super();

    // Read config file
    this.readConfigFile();

    // Initiate watcher
    this.watcher();
  }

  private _ons: onCallbackStore[] = [];
  public on(verb: "reload", callback: onCallback): onReturn {
    this._ons.push({ verb, callback });

    return {
      unsubscribe: () => {
        const callbackStoreIndex = this._ons.findIndex((callbackStore: onCallbackStore) => callback === callbackStore.callback);
        if (callbackStoreIndex !== -1) { this._ons.splice(callbackStoreIndex, 1); }
      }
    }
  }

  private watcher() {
    fs.watchFile(CONFIG_PATH, () => {
      this.readConfigFile();
    });
  }

  private readConfigFile() {
    if (fs.existsSync(CONFIG_PATH)) {
      try {
        this._attributes = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
      } catch (error) { }
      this.reloading();
      return;
    }
  }

  private reloading(): void {
    this._ons.filter((value: onCallbackStore) => value.verb === "reload").forEach((value: onCallbackStore) => value.callback(this._attributes));
  }
}

export const configService: ConfigService = ConfigService.getInstance<ConfigService>();
