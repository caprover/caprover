export default class Logger {
  static log(s: string) {
    console.log(s);
  }

  static error(s: any) {
    console.error(s);
  }

  static dev(s: string) {
    // TODO add debug check here
    console.log(">>> ", s);
  }
}
