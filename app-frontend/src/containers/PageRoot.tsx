import React, { Component } from "react";
import { RouteComponentProps } from "react-router";

export default class PageRoot extends Component<RouteComponentProps<any>> {
  componentDidMount() {
    /*if (is Logged in?) {
      this.props.history.push("/dashboard");
    } else {
      this.props.history.push("/login");
    }*/
  }

  render() {
    return (
      <div>
        <p>Page Root</p>
      </div>
    );
  }
}
