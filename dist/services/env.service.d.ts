import { ServiceModule } from "../modules/service.module";
export declare class EnvService extends ServiceModule {
    get(name: string): string | undefined;
    get(name: string, defaultValue: string): string;
}
export declare const envService: EnvService;
