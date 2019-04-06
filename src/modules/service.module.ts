export class ServiceModule {
  private static get instance(): ServiceModule {
    return this._instance !== undefined ? this._instance : new this();
  }
  public static getInstance<T>(): T {
    return this.instance as T;
  }
  private static _instance?: ServiceModule;
}
