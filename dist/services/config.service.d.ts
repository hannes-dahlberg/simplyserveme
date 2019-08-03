import { ServiceModule } from "../modules/service.module";
export declare type onCallback = (config?: IConfig) => void;
export interface IOnCallbackStore {
    verb: string;
    callback: onCallback;
}
export interface IOnReturn {
    unsubscribe: () => void;
}
export interface IConfig {
    port: number;
    sslPort: number;
    logOutputConsole: boolean;
    logDumpPath: string;
    hostsPath: string;
}
export declare const defaultConfig: IConfig;
export declare class ConfigService extends ServiceModule {
    readonly attributes: IConfig;
    private _attributes;
    private _ons;
    constructor();
    on(verb: "reload", callback: onCallback): IOnReturn;
    private watcher;
    private readConfigFile;
    private reloading;
}
export declare const configService: ConfigService;
