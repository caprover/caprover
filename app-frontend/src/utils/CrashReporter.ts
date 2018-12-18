// In the future this can be set up to report crashes
class CrashReporter {
  init() {}

  captureException(err: any) {
    err = err || "NULL";
    if (!(err instanceof Error)) err = new Error(err + "");
  }

  captureMessage(message: any) {}
}

let instance: CrashReporter | undefined = undefined;

const getInstance = function() {
  if (!instance) instance = new CrashReporter();
  return instance;
};

export default {
  getInstance: getInstance
};
