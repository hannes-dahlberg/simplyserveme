import { ServiceModule } from "..";
export declare class CommandService extends ServiceModule {
    start(): Promise<void>;
    init(): Promise<string>;
    create(domain: string, target: string, exec?: string): Promise<unknown>;
    enableDisable(verb: "enable" | "disable", domain: string): Promise<string>;
    certify(domain: string): Promise<void>;
    auth(domain: string, token: string, validation: string): Promise<void>;
    cleanup(domain: string): Promise<void>;
    private getHostFile;
    private saveHostFile;
    private getHostFilePath;
}
export declare const commandService: CommandService;
