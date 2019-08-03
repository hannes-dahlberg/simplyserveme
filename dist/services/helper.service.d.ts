import { ServiceModule } from "../modules/service.module";
export declare class HelperService extends ServiceModule {
    padStart(string: string, pad: number, fill?: string): string;
    dateTimeToString(date: Date | string): string;
}
export declare const helperService: HelperService;
