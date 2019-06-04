import { TransformableInfo } from "logform";
import * as winston from "winston";
import { helperService } from "../services/helper.service";

export interface ILogMessage { title: string; message?: string; type?: logType; data?: any; }
export interface ILogArgument { title: string; message?: string; }
export enum logType {
  INFO = "info",
  WARNING = "warn",
  ERROR = "error",
}

export class LogModule {
  private logger: winston.Logger;
  public constructor(outputToConsole: boolean = true, path?: string) {
    const format = [
      winston.format.timestamp(),
      winston.format.printf((info: TransformableInfo) => `${helperService.dateTimeToString(info.timestamp)} - ${info.level}: ${info.message}`),
    ];
    this.logger = winston.createLogger({
      transports: [
        ...(path !== undefined ? (() => {
          const matches = path.match(/^(.*\/)(.*)$/);

          return [new winston.transports.File({
            dirname: matches[1],
            filename: `${matches[2]}`,
            format: winston.format.combine(...format),
          })];
        })() : []),
        ...(outputToConsole ? [new winston.transports.Console({
          format: winston.format.combine(...[
            winston.format.colorize(),
            ...format,
          ]),
        })] : []),
      ],
    });
  }

  public info(message: string): void;
  public info(log: ILogArgument): void;
  public info(log: ILogArgument | string): void {
    this.add({ ...this.parseLogArgument(log), ...{ type: logType.INFO } });
  }

  public warning(message: string): void;
  public warning(log: ILogArgument): void;
  public warning(log: ILogArgument | string): void {
    this.add({ ...this.parseLogArgument(log), ...{ type: logType.WARNING } });
  }

  public error(message: string): void;
  public error(log: ILogArgument): void;
  public error(log: ILogArgument | string): void {
    this.add({ ...this.parseLogArgument(log), ...{ type: logType.ERROR } });
  }

  /**
   * Public method to add log message. Will output to console if set to do so
   * @param log Log message
   */
  public add(log: string): void;
  public add(log: ILogMessage): void;
  public add(log: ILogMessage | string): void {
    if (typeof log === "string") {
      log = { title: log };
    }
    if (log.type === undefined) { log.type = logType.INFO; }
    this.logger.log({
      level: log.type,
      message: this.printLogMessage(log),
    });
  }

  public end(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.on("close", () => {
        resolve();
      });
      this.logger.end();
    });
  }

  private parseLogArgument(info: ILogArgument | string): ILogArgument {
    if (typeof info === "string") {
      info = { title: info };
    }

    return info;
  }

  private printLogMessage(logMessage: ILogMessage): string {
    return `${logMessage.title}${logMessage.message !== undefined ? `: "${logMessage.message}"` : ``}`;
  }
}
