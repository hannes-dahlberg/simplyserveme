export interface ILogMessage {
    title: string;
    message?: string;
    type?: logType;
    data?: any;
}
export interface ILogArgument {
    title: string;
    message?: string;
}
export declare enum logType {
    INFO = "info",
    WARNING = "warn",
    ERROR = "error"
}
export declare class LogModule {
    private logger;
    constructor(outputToConsole?: boolean, path?: string);
    info(message: string): void;
    info(log: ILogArgument): void;
    warning(message: string): void;
    warning(log: ILogArgument): void;
    error(message: string): void;
    error(log: ILogArgument): void;
    add(log: string): void;
    add(log: ILogMessage): void;
    end(): Promise<void>;
    private parseLogArgument;
    private printLogMessage;
}
