import React, { Component } from "react";
import { Button, Row, Modal, Input, Tooltip, Icon } from "antd";
import {
  IRegistryInfo,
  IRegistryTypes,
  IRegistryApi
} from "../../models/IRegistryInfo";
import Utils from "../../utils/Utils";

const ADDING_LOCAL = "ADDING_LOCAL";
const ADDING_REMOTE = "ADDING_REMOTE";

export default class DockerRegistryAdd extends Component<
  {
    apiData: IRegistryApi;
    addDockerRegistry: (dockerRegistry: IRegistryInfo) => void;
  },
  {
    modalShowing: "ADDING_LOCAL" | "ADDING_REMOTE" | undefined;
    remoteRegistryToAdd: IRegistryInfo;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      modalShowing: undefined,
      remoteRegistryToAdd: this.getPlainRegistryInfo()
    };
  }

  getPlainRegistryInfo(): IRegistryInfo {
    return {
      id: "",
      registryUser: "",
      registryPassword: "",
      registryDomain: "",
      registryImagePrefix: "",
      registryType: IRegistryTypes.REMOTE_REG
    };
  }

  render() {
    const self = this;

    const hasSelfHostedRegistry =
      this.props.apiData.registries
        .map(reg => reg.registryType)
        .indexOf(IRegistryTypes.LOCAL_REG) >= 0;

    return (
      <div>
        <Modal
          title="Self-Hosted Registry"
          okText="Enable Self-Hosted Registry"
          onCancel={() => self.setState({ modalShowing: undefined })}
          onOk={() => {
            self.setState({ modalShowing: undefined });
            self.props.addDockerRegistry({
              registryType: IRegistryTypes.LOCAL_REG // Other values are getting ignored by the downstream callback
            } as IRegistryInfo);
          }}
          visible={self.state.modalShowing === ADDING_LOCAL}
        >
          <p>
            You can read more about this type of registry on the page behind
            this modal, specifically under "More Info" section. Do you want to
            proceed and enable self-hosted Docker Registry?
          </p>
        </Modal>

        <Modal
          title="Remote Registry"
          okText="Add Remote Registry"
          onCancel={() => self.setState({ modalShowing: undefined })}
          onOk={() => {
            self.setState({ modalShowing: undefined });
            self.props.addDockerRegistry(self.state.remoteRegistryToAdd);
          }}
          visible={self.state.modalShowing === ADDING_REMOTE}
        >
          <p>
            You can read more about this type of registry on the page behind
            this modal, specifically under "More Info" section.
          </p>
          <div style={{ height: 20 }} />
          <div style={{ maxWidth: 360 }}>
            <Input
              addonBefore="Username"
              placeholder="username | email@gmail.com"
              type="email"
              value={self.state.remoteRegistryToAdd.registryUser}
              onChange={e => {
                const newData = Utils.copyObject(
                  self.state.remoteRegistryToAdd
                );
                newData.registryUser = e.target.value.trim();
                self.setState({ remoteRegistryToAdd: newData });
              }}
            />
            <div style={{ height: 20 }} />
            <Input
              addonBefore="Password"
              placeholder="mypassword"
              type="text"
              value={self.state.remoteRegistryToAdd.registryPassword}
              onChange={e => {
                const newData = Utils.copyObject(
                  self.state.remoteRegistryToAdd
                );
                newData.registryPassword = e.target.value;
                self.setState({ remoteRegistryToAdd: newData });
              }}
            />
            <div style={{ height: 20 }} />
            <Input
              addonBefore="Domain"
              placeholder="registry-1.docker.io"
              type="text"
              value={self.state.remoteRegistryToAdd.registryDomain}
              onChange={e => {
                const newData = Utils.copyObject(
                  self.state.remoteRegistryToAdd
                );
                newData.registryDomain = e.target.value.trim();
                self.setState({ remoteRegistryToAdd: newData });
              }}
            />
            <div style={{ height: 20 }} />
            <Input
              addonBefore="Image Prefix"
              placeholder="username"
              addonAfter={
                <Tooltip title="Your images will be tagged as RegistryDomain/ImagePrefix/ImageName. For most providers, Image Prefix is exactly your username, unless the field DOMAIN is specific to you, in that case, this prefix is empty.">
                  <Icon type="info-circle" />
                </Tooltip>
              }
              type="text"
              value={self.state.remoteRegistryToAdd.registryImagePrefix}
              onChange={e => {
                const newData = Utils.copyObject(
                  self.state.remoteRegistryToAdd
                );
                newData.registryImagePrefix = e.target.value.trim();
                self.setState({ remoteRegistryToAdd: newData });
              }}
            />
          </div>
        </Modal>

        <div className={hasSelfHostedRegistry ? "hide-on-demand" : ""}>
          <Row type="flex" justify="end">
            <Button
              onClick={() => self.setState({ modalShowing: ADDING_LOCAL })}
            >
              Add Self-Hosted Registry
            </Button>
          </Row>
        </div>

        <div style={{ height: 20 }} />
        <Row type="flex" justify="end">
          <Button
            onClick={() =>
              self.setState({
                modalShowing: ADDING_REMOTE,
                remoteRegistryToAdd: self.getPlainRegistryInfo()
              })
            }
          >
            Add Remote Registry
          </Button>
        </Row>
      </div>
    );
  }
}
