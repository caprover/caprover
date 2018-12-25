import React, { Component } from "react";
import { Collapse, Row } from "antd";
import DockerRegistriesStaticInfo from "./DockerRegistriesStaticInfo";
import ApiComponent from "../global/ApiComponent";
import CenteredSpinner from "../global/CenteredSpinner";
import Toaster from "../../utils/Toaster";
import DefaultDockerRegistry from "./DefaultDockerRegistry";
import DockerRegistryTable from "./DockerRegistryTable";

export default class DockerRegistries extends ApiComponent<
  {},
  { apiData: any }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      apiData: undefined
    };
  }

  fetchData() {
    const self = this;
    this.setState({ apiData: undefined });
    this.apiManager
      .getDockerRegistries()
      .then(function(data) {
        self.setState({ apiData: data });
      })
      .catch(Toaster.createCatcher());
  }

  componentDidMount() {
    this.fetchData();
  }

  render() {
    const self = this;
    if (!this.state.apiData) {
      return <CenteredSpinner />;
    }

    return (
      <div>
        <DockerRegistriesStaticInfo />
        <DefaultDockerRegistry
          apiData={self.state.apiData}
          changeDefault={id => {}}
        />
        <DockerRegistryTable
          apiData={self.state.apiData}
          deleteRegistry={id => {}}
          editRegistry={dockerRegistry => {}}
        />
      </div>
    );
  }
}
