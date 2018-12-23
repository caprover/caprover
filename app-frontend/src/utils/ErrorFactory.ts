import CrashReporter from "./CrashReporter";

class ErrorFactory {
  public readonly OKAY = 100;
  public readonly OKAY_BUILD_STARTED = 101;

  public readonly STATUS_ERROR_GENERIC = 1000;
  public readonly STATUS_ERROR_CAPTAIN_NOT_INITIALIZED = 1001;
  public readonly STATUS_ERROR_USER_NOT_INITIALIZED = 1101;
  public readonly STATUS_ERROR_NOT_AUTHORIZED = 1102;
  public readonly STATUS_ERROR_ALREADY_EXIST = 1103;
  public readonly STATUS_ERROR_BAD_NAME = 1104;
  public readonly STATUS_WRONG_PASSWORD = 1105;
  public readonly STATUS_AUTH_TOKEN_INVALID = 1106;
  public readonly VERIFICATION_FAILED = 1107;

  public readonly UNKNOWN_ERROR = 1999;

  constructor() {}

  createError(status: number, message: string) {
    let e = new Error(message) as any;
    e.captainStatus = status;
    e.captainMessage = message;
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
