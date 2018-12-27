import axios from "axios";
import { IOneClickAppIdentifier } from "../containers/apps/oneclick/OneClickAppSelector";

const DOT_JSON = ".JSON";

export default class OneClickAppsApi {
  getOneClickAppByName(appName: string) {
    const self = this;
    return self.getAllOneClickApps().then(function(data) {
      if (!appName) throw new Error("appName is empty!");

      const urlToDownloadJson = data.filter(value => value.name === appName)[0]
        .download_url;

      return axios
        .get(urlToDownloadJson) //
        .then(function(res) {
          // res contains data, headers, and etc...
          return res.data;
        });
    });
  }

  getAllOneClickApps() {
    const self = this;
    return axios
      .get(
        `https://api.github.com/repos/${
          process.env.REACT_APP_ONECLICK_REPO
        }/contents/one-click-apps/v1`
      ) //
      .then(function(res) {
        // res contains data, headers, and etc...
        return (res.data as IOneClickAppIdentifier[]).map(element => {
          return {
            name: element.name.substr(0, element.name.length - DOT_JSON.length),
            download_url: element.download_url
          };
        });
      });
  }
}
