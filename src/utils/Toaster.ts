import { message, Button } from "antd";

export default class Toaster {
  static toast(error: any) {
    let errorMessage = "Something bad happened.";
    if (error.captainStatus) {
      let errorDescription = error.captainMessage || errorMessage;
      errorMessage = `${error.captainStatus} : ${errorDescription}`;
    }
    message.error(errorMessage);
  }

  static createCatcher(functionToRun?: Function) {
    return function(error: any) {
      Toaster.toast(error);
      if (functionToRun) {
        functionToRun();
      }
    };
  }
}
