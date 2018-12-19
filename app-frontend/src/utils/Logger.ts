export default class Logger {
  static log(s: string) {
    console.log(s);
  }

  static dev(s: string) {
    // TODO add debug check here
    console.log(">>> " + s);
  }
}
