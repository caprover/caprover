import HttpClient from "./HttpClient";

const URL = process.env.REACT_APP_API_URL + "/api/v1";

export default class ApiManager {
  private http = new HttpClient(URL);
  constructor() {}

  destroy() {
    this.http.destroy();
  }

  getAuthToken(username: string, password: string) {
    const http = this.http;

    return Promise.resolve() //
      .then(http.fetch(http.POST, "/api/auth", { username, password }));
  }
}
