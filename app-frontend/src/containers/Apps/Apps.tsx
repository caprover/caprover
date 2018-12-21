import React, { Component } from "react";
import { Row, Col, Card } from "antd";
import ApiComponent from "../global/ApiComponent";
import Toaster from "../../utils/Toaster";
import Search from "antd/lib/input/Search";
import CenteredSpinner from "../global/CenteredSpinner";
import CreateNewApp from "./CreateNewApp";
import AppsTable from "./AppsTable";

export default class Apps extends ApiComponent<
  {},
  { isLoading: boolean; apiData: any }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      isLoading: true,
      apiData: undefined
    };
  }

  onCreateOneClickAppClicked() {
    //
    alert("onCreateOneClickAppClicked");
  }

  onCreateNewAppClicked(appName: string, hasPersistentData: boolean) {
    const self = this;

    Promise.resolve() //
      .then(function() {
        self.setState({ isLoading: true });
        return self.apiManager.registerNewApp(appName, hasPersistentData);
      })
      .then(function(data) {
        self.reFetchData();
      })
      .catch(Toaster.createCatcher());
  }

  render() {
    const self = this;

    if (self.state.isLoading) {
      return <CenteredSpinner />;
    }

    return (
      <div>
        <CreateNewApp
          onCreateNewAppClicked={(appName: string, hasPersistency: boolean) => {
            self.onCreateNewAppClicked(appName, hasPersistency);
          }}
          onCreateOneClickAppClicked={() => {
            self.onCreateOneClickAppClicked();
          }}
        />
        <div style={{ height: 25 }} />
        {self.state.apiData.appDefinitions.length > 0 ? (
          <AppsTable
            defaultNginxConfig={this.state.apiData.defaultNginxConfig}
            apps={this.state.apiData.appDefinitions}
            rootDomain={this.state.apiData.rootDomain}
          />
        ) : (
          <div />
        )}
      </div>
    );
  }

  componentDidMount() {
    this.reFetchData();
  }

  reFetchData() {
    const self = this;
    self.setState({ isLoading: true });
    this.apiManager
      .getAllApps()
      .then(function(data: any) {
        self.setState({ isLoading: false, apiData: data });
      })
      .catch(Toaster.createCatcher());
  }
}
