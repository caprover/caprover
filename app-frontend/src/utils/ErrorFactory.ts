import CrashReporter from "./CrashReporter";

class ErrorFactory {
  public readonly UNKNOWN_ERROR = 9999;
  public readonly STATUS_ERROR_GENERIC = 1000;
  public readonly STATUS_INVALID_INPUT = 1001;
  public readonly STATUS_ERROR_NOT_FOUND = 1002;

  constructor() {}

  createError(status: number, message: string) {
    let e = new Error(message) as any;
    e.errorStatus = status;
    return e;
  }

  eatUpPromiseRejection() {
    return function(error: any) {
      CrashReporter.getInstance().captureException(error);
      // nom nom
    };
  }
}

export default new ErrorFactory();
