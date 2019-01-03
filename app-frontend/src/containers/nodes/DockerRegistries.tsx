import React, { Component } from "react";
import { Collapse, Row, Button, Alert, message } from "antd";
import DockerRegistriesStaticInfo from "./DockerRegistriesStaticInfo";
import ApiComponent from "../global/ApiComponent";
import CenteredSpinner from "../global/CenteredSpinner";
import Toaster from "../../utils/Toaster";
import DefaultDockerRegistry from "./DefaultDockerRegistry";
import DockerRegistryTable from "./DockerRegistryTable";
import { connect } from "react-redux";
import {
  IRegistryApi,
  IRegistryInfo,
  IRegistryTypes
} from "../../models/IRegistryInfo";
import DockerRegistryAdd from "./DockerRegistryAdd";
import { emitDefaultRegistryChanged } from "../../actions/DefaultRegistryActions";
import ErrorRetry from "../global/ErrorRetry";

class DockerRegistries extends ApiComponent<
  { emitDefaultRegistryChanged: Function },
  { apiData: IRegistryApi | undefined; isLoading: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      apiData: undefined,
      isLoading: true
    };
  }

  fetchData() {
    const self = this;
    this.setState({ apiData: undefined, isLoading: true });
    this.apiManager
      .getDockerRegistries()
      .then(function(data) {
        self.setState({ apiData: data });
        self.props.emitDefaultRegistryChanged(
          (data as IRegistryApi).defaultPushRegistryId
        );
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.setState({ isLoading: false });
      });
  }

  changeDefault(id: string) {
    const self = this;
    this.setState({ apiData: undefined, isLoading: true });

    this.apiManager
      .setDefaultPushDockerRegistry(id)
      .then(function() {
        message.success("Default push registry successfully changed.");
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.fetchData();
      });
  }

  deleteRegistry(id: string) {
    const self = this;

    const isSelfHosted =
      self.state
        .apiData!.registries.map(
          reg => reg.registryType === IRegistryTypes.LOCAL_REG && reg.id === id
        )
        .indexOf(true) >= 0;

    this.setState({ apiData: undefined, isLoading: true });

    (isSelfHosted
      ? this.apiManager.disableSelfHostedDockerRegistry()
      : this.apiManager.deleteDockerRegistry(id)
    )
      .then(function() {
        message.success("Registry deleted.");
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.fetchData();
      });
  }

  editRegistry(dockerRegistry: IRegistryInfo) {
    const self = this;
    this.setState({ apiData: undefined, isLoading: true });

    this.apiManager
      .updateDockerRegistry(dockerRegistry)
      .then(function() {
        message.success("Registry updated.");
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.fetchData();
      });
  }

  addDockerRegistry(dockerRegistry: IRegistryInfo) {
    const self = this;
    this.setState({ apiData: undefined, isLoading: true });
    (dockerRegistry.registryType === IRegistryTypes.LOCAL_REG
      ? self.apiManager.enableSelfHostedDockerRegistry()
      : self.apiManager.addDockerRegistry(dockerRegistry)
    )
      .then(function() {
        message.success("Docker registry successfully added!");
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.fetchData();
      });
  }

  componentDidMount() {
    this.fetchData();
  }

  render() {
    const self = this;
    if (this.state.isLoading) {
      return <CenteredSpinner />;
    }

    if (!this.state.apiData) {
      return <ErrorRetry />;
    }

    return (
      <div>
        <DockerRegistriesStaticInfo />

        <div style={{ height: 60 }} />
        <div
          style={{ textAlign: "center" }}
          className={
            this.state.apiData.registries.length === 0 ? "" : "hide-on-demand"
          }
        >
          <Alert
            type="info"
            message="No registries is added yet. Go ahead and add your first registry!"
          />
        </div>

        <div
          className={
            this.state.apiData.registries.length > 0 ? "" : "hide-on-demand"
          }
        >
          <DefaultDockerRegistry
            apiData={self.state.apiData!}
            changeDefault={id => {
              self.changeDefault(id);
            }}
          />

          <div style={{ height: 40 }} />

          <DockerRegistryTable
            apiData={self.state.apiData!}
            deleteRegistry={id => {
              self.deleteRegistry(id);
            }}
            editRegistry={dockerRegistry => {
              self.editRegistry(dockerRegistry);
            }}
          />
        </div>
        <div style={{ height: 50 }} />
        <DockerRegistryAdd
          apiData={self.state.apiData!}
          addDockerRegistry={dockerRegistry =>
            self.addDockerRegistry(dockerRegistry)
          }
        />
      </div>
    );
  }
}

function mapStateToProps(state: any) {
  return {
    defaultRegistryId: state.registryReducer.defaultRegistryId
  };
}

export default connect(
  mapStateToProps,
  {
    emitDefaultRegistryChanged: emitDefaultRegistryChanged
  }
)(DockerRegistries);
