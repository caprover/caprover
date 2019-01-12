import React, { Component } from "react";
import { RouteComponentProps } from "react-router";
import ApiManager from "../api/ApiManager";

export default class LoggedInCatchAll extends Component<
  RouteComponentProps<any>
> {
  componentDidMount() {
    if (!ApiManager.isLoggedIn()) {
      this.props.history.push("/login");
    } else {
      this.props.history.push("/dashboard");
    }
  }

  render() {
    return <div />;
  }
}
