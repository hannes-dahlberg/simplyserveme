import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { ServiceModule } from "../modules/service.module";

export type onCallback = (config?: IConfig) => void;
export interface IOnCallbackStore { verb: string; callback: onCallback; }
export interface IOnReturn { unsubscribe: () => void; }

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
};

export class ConfigService extends ServiceModule {

  public get attributes(): IConfig { return this._attributes; }
  private _attributes: IConfig = defaultConfig;

  private _ons: IOnCallbackStore[] = [];

  public constructor() {
    super();

    // Read config file
    this.readConfigFile();

    // Initiate watcher
    this.watcher();
  }
  public on(verb: "reload", callback: onCallback): IOnReturn {
    this._ons.push({ verb, callback });

    return {
      unsubscribe: () => {
        const callbackStoreIndex = this._ons.findIndex((callbackStore: IOnCallbackStore) => callback === callbackStore.callback);
        if (callbackStoreIndex !== -1) { this._ons.splice(callbackStoreIndex, 1); }
      },
    };
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
      } catch (error) {
        //
      }
      this.reloading();
      return;
    }
  }

  private reloading(): void {
    this._ons.filter((value: IOnCallbackStore) => value.verb === "reload").forEach((value: IOnCallbackStore) => value.callback(this._attributes));
  }
}

export const configService: ConfigService = ConfigService.getInstance<ConfigService>();
