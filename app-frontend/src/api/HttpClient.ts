import axios from "axios";
import ErrorFactory from "../utils/ErrorFactory";
import Logger from "../utils/Logger";

axios.defaults.headers.common["x-namespace"] = "captain";

export default class HttpClient {
  public readonly GET = "GET";
  public readonly POST = "POST";
  public isDestroyed = false;

  constructor(private baseUrl: string) {}

  destroy() {
    this.isDestroyed = true;
  }

  fetch(method: "GET" | "POST", endpoint: string, variables: any) {
    const self = this;
    return function(): Promise<any> {
      return self
        .fetchInternal(method, endpoint, variables) //
        .then(function(data) {
          return data.data; // this is an axios thing!
        })
        .then(function(data) {
          if (data.status !== ErrorFactory.OKAY) {
            throw ErrorFactory.createError(
              data.status || ErrorFactory.UNKNOWN_ERROR,
              data.description || ""
            );
          }
          return data;
        })
        .then(function(data) {
          // These two blocks are clearly memory leaks! But I don't have time to fix them now... I need to CANCEL the promise, but since I don't
          // have CANCEL method on the native Promise, I return a promise that will never RETURN if the HttpClient is destroyed.
          // Will fix them later... but it shouldn't be a big deal anyways as it's only a problem when user navigates away from a page before the
          // network request returns back.
          return new Promise(function(resolve, reject) {
            // data.data here is the "data" field inside the API response! {status: 100, description: "Login succeeded", data: {…}}
            if (!self.isDestroyed) return resolve(data.data);
          });
        })
        .catch(function(error) {
          Logger.error(error);
          return new Promise(function(resolve, reject) {
            if (!self.isDestroyed) return reject(error);
          });
        });
    };
  }

  fetchInternal(method: "GET" | "POST", endpoint: string, variables: any) {
    if (method === this.GET) return this.getReq(endpoint, variables);

    if (method === this.POST) return this.postReq(endpoint, variables);

    throw new Error("Unknown method: " + method);
  }

  getReq(endpoint: string, variables: any) {
    return axios
      .get(this.baseUrl + endpoint, {
        params: variables
      }) //
      .then(function(data) {
        //console.log(data);
        return data;
      });
  }

  postReq(endpoint: string, variables: any) {
    return axios
      .post(this.baseUrl + endpoint, variables) //
      .then(function(data) {
        //console.log(data);
        return data;
      });
  }
}
