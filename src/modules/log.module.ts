import * as fs from "fs";
import * as path from "path";
import { EnvService, envService as envServiceReference } from "../services/env.service";
import { helperService } from "../services/helper.service";

export interface ILogMessage { title: string; message?: string; type?: logType; data?: any; }
export enum logType {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
}

export class LogModule {
  private outputToConsole: boolean = true;
  private dumpPath: string = "./log";

  public constructor(path?: string);
  public constructor(
    private path?: string,
    private envService: EnvService = envServiceReference,
  ) {
    this.outputToConsole = this.envService.get("LOG_OUTPUT_CONSOLE") === "true";
    this.dumpPath = this.envService.get("LOG_DUMP_PATH", this.dumpPath);
  }

  /**
   * Public method to add log message. Will output to console if set to do so
   * @param logMessage Log message
   */
  public add(logMessage: string): void
  public add(logMessage: ILogMessage): void
  public add(logMessage: ILogMessage | string): void {
    if (typeof logMessage === "string") {
      logMessage = { title: logMessage };
    }
    if (logMessage.type === undefined) { logMessage.type = logType.INFO; }
    this.addToLogMessages(logMessage);

    if (this.outputToConsole) {
      switch (logMessage.type) {
        case logType.INFO:
          console.log(
            ...[
              "\x1b[34m%s\x1b[0m",
              this.printLogMessage(logMessage),
              ...(logMessage.data !== undefined ? [logMessage.data] : [])
            ]);
          break;
        case logType.WARNING:
          console.warn(
            ...[
              "\x1b[33m%s\x1b[0m",
              this.printLogMessage(logMessage),
              ...(logMessage.data !== undefined ? [logMessage.data] : [])
            ]);
          break;
        case logType.ERROR:
          console.error(
            ...[
              "\x1b[31m%s\x1b[0m",
              this.printLogMessage(logMessage),
              ...(logMessage.data !== undefined ? [logMessage.data] : [])
            ]);
          break;
      }
    }
  }

  /**
   * Adding log message to log array and dump if array is to long
   * @param logMessage Log message
   */
  private addToLogMessages(logMessage: ILogMessage): void {
    fs.writeFileSync(path.resolve(this.dumpPath, `${this.path}.log`),
      `${helperService.dateTimeToString(new Date())} ${logMessage.type !== undefined ? logMessage.type.toUpperCase() : logType.INFO.toUpperCase()} - ${this.printLogMessage(logMessage)}${logMessage.data !== undefined ? ` - DATA: ${JSON.stringify(logMessage.data)}` : ""}\n`,
      { flag: "a" });
  }

  private printLogMessage(logMessage: ILogMessage): string {
    return `${logMessage.title}${logMessage.message !== undefined ? `: "${logMessage.message}"` : ``}`;
  }
}
