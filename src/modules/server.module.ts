// Importing node modules
import * as bodyParser from "body-parser";
import * as cors from "cors";
import { CorsOptions, CorsOptionsDelegate } from "cors";
import * as express from "express";
import { NextFunction, Request, Response } from "express";
import * as http from "http";
import * as https from "https";
import * as tls from "tls";
import * as vhost from "vhost";

export type corsConfigType = string | string[] | CorsOptions | CorsOptionsDelegate;
export type credentials = {
    cert: string,
    key: string
}

// Config interface
export interface IApp {
    domain: string;
    https?: boolean;
    httpsRedirect?: boolean;
    credentials?: credentials;
}
export interface IAPIApp extends IApp {
    routes?: express.Router;
    corsConfig?: corsConfigType;
}

export interface ISPAApp extends IApp {
    staticPath: string;
    apiBaseUrl?: string;
}

export type app = IAPIApp | ISPAApp;
export type appType = "api" | "spa";

export interface IConfig {
    port: number;
    securePort?: number,
    apps: app[]
}

export class Server {
    // App
    private server: express.Express;
    private apps: app[];

    constructor(app: app, port?: number, securePort?: number)
    constructor(apps: app[], port?: number, securePort?: number)
    constructor(apps: app | app[], private port: number = 80, private securePort: number = 443) {
        if (!(apps instanceof Array)) { apps = [apps]; }
        this.apps = apps;
        // Creating the express app
        this.server = express();

        for (const app of apps) {
            this.server.use(this.createApp(app));
        }
    }
    public start(): Promise<http.Server> {
        return new Promise((resolve, reject) => {
            // Start http server
            const listener = this.server.listen(this.port, () => {
                this.apps.filter((app: app) => !app.https || (app.https && !app.httpsRedirect)).forEach((app: app) => {
                    console.log(`Serving ${this.appType(app).toUpperCase()} on: http://${app.domain}:${this.port}${("staticPath" in app) ? ` with static root: "${app.staticPath}"` : ``}`);
                });
                resolve(listener);
            });

            //If any app is set to use https start https server
            if (this.apps.find((app: app) => app.https)) {
                const server = https.createServer({
                    SNICallback: (domain: string, callback) => {
                        let config = this.apps.find((app: IApp) => app.domain === domain && app.https && app.credentials !== undefined);
                        if (config !== undefined) {
                            callback(null, tls.createSecureContext({
                                cert: config.credentials.cert,
                                key: config.credentials.key,
                            }));
                        } else {
                            callback(null, tls.createSecureContext({
                                cert: "",
                                key: ""
                            }));
                        }
                    },
                    key: "",
                    cert: "",
                }, this.server)
                if (this.securePort !== undefined) {
                    server.listen(this.securePort, () => {
                        this.apps.filter((app: app) => app.https && app.credentials !== undefined).forEach((app: app) => {
                            console.log(`Serving ${this.appType(app).toUpperCase()} on: https://${app.domain}:${this.securePort}${("staticPath" in app) ? ` with static root: "${app.staticPath}"` : ``}`);
                        });
                    });
                }
            }
        });
    }

    private createApp(appData: app): vhost.RequestHandler {
        const app: express.Express = express();

        // Throws error if https is enabled but credentials are missing
        if (appData.https && appData.credentials === undefined) {
            throw new Error("HTTPS is turned on but certificat property is missing");
        }

        // Adds route to redirect to https if protocol is http
        if (appData.https && appData.httpsRedirect) {
            app.get('*', (request: Request, response: Response, next: NextFunction) => {
                if (request.protocol === "http") { response.redirect(`https://${request.headers.host.replace(`:${this.port}`, `:${this.securePort}`)}${request.url}`); return; }
                next();
            });
        }

        if (this.appType(appData) === "api") {
            const tempAppData = appData as IAPIApp;
            if (tempAppData.corsConfig) {

                if (typeof tempAppData.corsConfig === "string" || tempAppData.corsConfig instanceof Array) {
                    tempAppData.corsConfig
                    tempAppData.corsConfig = {
                        origin: tempAppData.corsConfig,
                    };
                }
                app.use(cors(tempAppData.corsConfig));
            }

            // Attaching body parser
            app.use(bodyParser.urlencoded({
                extended: true,
            }));

            // Parse post body as json
            app.use(bodyParser.json());

            // Add provided routes
            if (tempAppData.routes) {
                app.use("/", tempAppData.routes);
            }
        } else if (this.appType(appData) === "spa") {
            const tempAppData = appData as ISPAApp;

            // Add route for getting API base url
            if (tempAppData.apiBaseUrl !== undefined) {
                app.head('/api_base_url', (request: Request, response: Response, next: NextFunction) => {
                    response.setHeader("api_base_url", tempAppData.apiBaseUrl);
                    next();
                });
            }

            // Add static path
            app.use(express.static(tempAppData.staticPath));

            app.get("*", (request: Request, response: Response) => {
                response.sendFile("index.html", { root: tempAppData.staticPath });
            });
        }

        return vhost(appData.domain, app);
    }

    private appType(app: app): appType {
        return "staticPath" in app ? "spa" : "api";
    }
}