/// <reference types="node" />
import { ChildProcess } from "child_process";
import * as express from "express";
import { ServiceModule } from "../modules/service.module";
export { Server } from "../modules/server.module";
export interface IHost {
    domain: string;
    target: string;
    exec?: string;
    enable: boolean;
    security?: ISecurity;
    redirectToHttps?: boolean;
    letsEncryptAuth?: {
        validation: string;
        token: string;
    };
    blackListIps?: string[];
    whiteListIps?: string[];
}
interface IProcess {
    id: string;
    process: ChildProcess;
}
interface ISecurity {
    key: string;
    cert: string;
    ca: string;
}
declare class ServerService extends ServiceModule {
    private app;
    private processes;
    private readonly logPath;
    private _state;
    private _servers;
    private _connections;
    private hostWatcher;
    private certFiles;
    private configs;
    private log;
    constructor(app?: express.Express, processes?: IProcess[]);
    start(): Promise<void>;
    stop(): Promise<void>;
    restart(): void;
    private endConnections;
    private closeServers;
    private loadHosts;
}
export declare const server: ServerService;
