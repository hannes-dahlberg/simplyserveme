/// <reference types="node" />
import { CorsOptions, CorsOptionsDelegate } from "cors";
import * as express from "express";
import * as http from "http";
export declare type corsConfigType = string | string[] | CorsOptions | CorsOptionsDelegate;
export interface ICredentials {
    cert: string;
    key: string;
}
export interface IApp {
    domain: string;
    https?: boolean;
    httpsRedirect?: boolean;
    credentials?: ICredentials;
}
export interface IAPIApp extends IApp {
    routes?: express.Router;
    corsConfig?: corsConfigType;
}
export interface ISPAApp extends IApp {
    staticPath: string;
    apiBaseUrl?: string;
}
export declare type app = IAPIApp | ISPAApp;
export declare type appType = "api" | "spa";
export interface IConfig {
    port: number;
    securePort?: number;
    apps: app[];
}
export declare class Server {
    private port;
    private securePort;
    private server;
    private apps;
    constructor(app: app, port?: number, securePort?: number);
    constructor(apps: app[], port?: number, securePort?: number);
    start(): Promise<http.Server>;
    private createApp;
    private appType;
}
