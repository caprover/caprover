import React, { Component } from "react";
import { Row, Col, Card } from "antd";
import ApiComponent from "../global/ApiComponent";
import Toaster from "../../utils/Toaster";
import Search from "antd/lib/input/Search";
import CenteredSpinner from "../global/CenteredSpinner";
import CreateNewApp from "./CreateNewApp";
import AppsTable from "./AppsTable";
import { Switch, Route, RouteComponentProps } from "react-router";
import Apps from "./Apps";

export default class AppDetails extends Component<RouteComponentProps<any>> {
  render() {
    if (this.props.match.params.appName) {
      return <div>{this.props.match.params.appName}</div>;
    }

    return <div />;
  }
}
