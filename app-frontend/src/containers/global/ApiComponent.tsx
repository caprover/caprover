import { Component } from "react";
import ApiManager from "../../api/ApiManager";

export default class ApiComponent<P = {}, S = {}> extends Component<P, S> {
  protected willUnmountSoon: boolean;
  protected apiManager: ApiManager;

  constructor(props: any) {
    super(props);
    this.willUnmountSoon = false;
    this.apiManager = new ApiManager();
  }

  componentWillUnmount() {
    this.willUnmountSoon = true;
    this.apiManager.destroy();
  }
}
