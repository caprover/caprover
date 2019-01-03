import React, { Component } from "react";
import { Row, Col, Card } from "antd";
import ApiComponent from "../global/ApiComponent";
import Toaster from "../../utils/Toaster";
import Search from "antd/lib/input/Search";
import CenteredSpinner from "../global/CenteredSpinner";
import CreateNewApp from "./CreateNewApp";
import AppsTable from "./AppsTable";
import { RouteComponentProps } from "react-router";
import { IAppDef } from "./AppDefinition";
import ErrorRetry from "../global/ErrorRetry";

export default class Apps extends ApiComponent<
  RouteComponentProps<any>,
  {
    isLoading: boolean;
    apiData:
      | {
          appDefinitions: IAppDef[];
          defaultNginxConfig: string;
          rootDomain: string;
        }
      | undefined;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      isLoading: true,
      apiData: undefined
    };
  }

  onCreateOneClickAppClicked() {
    this.props.history.push(`/apps/oneclick/`);
  }

  onCreateNewAppClicked(appName: string, hasPersistentData: boolean) {
    const self = this;

    Promise.resolve() //
      .then(function() {
        self.setState({ isLoading: true });
        return self.apiManager.registerNewApp(appName, hasPersistentData);
      })
      .then(function() {
        return self.reFetchData();
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.setState({ isLoading: false });
      });
  }

  render() {
    const self = this;

    if (self.state.isLoading) {
      return <CenteredSpinner />;
    }

    const apiData = self.state.apiData;

    if (!apiData) {
      return <ErrorRetry />;
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
        {apiData.appDefinitions.length > 0 ? (
          <AppsTable
            history={this.props.history}
            defaultNginxConfig={apiData.defaultNginxConfig}
            apps={apiData.appDefinitions}
            rootDomain={apiData.rootDomain}
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
    return this.apiManager
      .getAllApps()
      .then(function(data: any) {
        self.setState({ apiData: data });
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.setState({ isLoading: false });
      });
  }
}
