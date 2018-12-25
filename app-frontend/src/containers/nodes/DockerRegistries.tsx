import React, { Component } from "react";
import { Collapse, Row } from "antd";
import DockerRegistriesStaticInfo from "./DockerRegistriesStaticInfo";
import ApiComponent from "../global/ApiComponent";
import CenteredSpinner from "../global/CenteredSpinner";
import Toaster from "../../utils/Toaster";
import DefaultDockerRegistry from "./DefaultDockerRegistry";
import DockerRegistryTable from "./DockerRegistryTable";
import { IRegistryApi, IRegistryInfo } from "../../models/IRegistryInfo";

export default class DockerRegistries extends ApiComponent<
  {},
  { apiData: IRegistryApi | undefined }
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

  changeDefault(id: string) {
    // TODO
    console.log("changeDefault: ", id);
  }

  deleteRegistry(id: string) {
    // TODO
    console.log("deleteRegistry: ", id);
  }

  editRegistry(dockerRegistry: IRegistryInfo) {
    // TODO
    console.log("editRegistry: ", dockerRegistry);
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

        <div style={{ height: 30 }} />

        <DefaultDockerRegistry
          apiData={self.state.apiData!}
          changeDefault={id => {
            self.changeDefault(id);
          }}
        />

        <div style={{ height: 20 }} />

        <DockerRegistryTable
          apiData={self.state.apiData}
          deleteRegistry={id => {
            self.deleteRegistry(id);
          }}
          editRegistry={dockerRegistry => {
            self.editRegistry(dockerRegistry);
          }}
        />
      </div>
    );
  }
}
