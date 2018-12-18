import CrashReporter from "./CrashReporter";

class ErrorFactory {
  public UNKNOWN_ERROR = 9999;
  public STATUS_ERROR_GENERIC = 1000;
  public STATUS_INVALID_INPUT = 1001;
  public STATUS_ERROR_NOT_FOUND = 1002;
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
