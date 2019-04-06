import * as dotenv from "dotenv";
import { ServiceModule } from "../modules/service.module";

// Load env config
dotenv.config();

export class EnvService extends ServiceModule {
  public get(name: string): string | undefined;
  public get(name: string, defaultValue: string): string;
  public get(name: string, defaultValue?: string): string | undefined {
    return process.env[name] || defaultValue;
  }
}

export const envService: EnvService = EnvService.getInstance<EnvService>();
