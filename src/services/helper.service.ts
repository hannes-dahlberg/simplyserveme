import { ServiceModule } from "../modules/service.module";

export class HelperService extends ServiceModule {
  public padStart(string: string, pad: number, fill: string = " "): string {
    return `${fill.repeat(Math.max(0, pad - string.length))}${string}`;
  }
  public dateTimeToString(date: Date | string): string {
    if (typeof date === "string") { date = new Date(date); }
    return `${date.getFullYear()}-${this.padStart(date.getMonth().toString(), 2, "0")}-${this.padStart(date.getDate().toString(), 2, "0")} ${this.padStart(date.getHours().toString(), 2, "0")}:${this.padStart(date.getMinutes().toString(), 2, "0")}:${this.padStart(date.getSeconds().toString(), 2, "0")}`
  }
}

export const helperService: HelperService = HelperService.getInstance<HelperService>();
