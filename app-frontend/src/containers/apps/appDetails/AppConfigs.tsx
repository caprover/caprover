import React, { Component } from "react";
import {
  message,
  Row,
  Button,
  Input,
  Col,
  Icon,
  Tooltip,
  Checkbox
} from "antd";
import Toaster from "../../../utils/Toaster";
import Utils from "../../../utils/Utils";
import { AppDetailsTabProps } from "./AppDetails";
import ClickableLink from "../../global/ClickableLink";

const Search = Input.Search;

export default class AppConfigs extends Component<
  AppDetailsTabProps,
  {
    dummyVar: undefined;
    forceEditableNodeId: boolean;
    forceEditableInstanceCount: boolean;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      dummyVar: undefined,
      forceEditableInstanceCount: false,
      forceEditableNodeId: false
    };
  }

  createEnvVarRows() {
    const self = this;
    const envVars = this.props.apiData.appDefinition.envVars || [];
    return envVars.map((value, index) => {
      return (
        <Row style={{ paddingBottom: 12 }} key={"" + index}>
          <Col span={8}>
            <Input
              className="code-input"
              placeholder="key"
              value={value.key}
              type="text"
              onChange={e => {
                const newApiData = Utils.copyObject(self.props.apiData);
                newApiData.appDefinition.envVars[index].key = e.target.value;
                self.props.updateApiData(newApiData);
              }}
            />
          </Col>
          <Col style={{ paddingLeft: 12 }} span={16}>
            <Input.TextArea
              className="code-input"
              placeholder="value"
              rows={1}
              value={value.value}
              onChange={e => {
                const newApiData = Utils.copyObject(self.props.apiData);
                newApiData.appDefinition.envVars[index].value = e.target.value;
                self.props.updateApiData(newApiData);
              }}
            />
          </Col>
        </Row>
      );
    });
  }

  createPortRows() {
    const self = this;
    const ports = this.props.apiData.appDefinition.ports || [];
    return ports.map((value, index) => {
      return (
        <Row style={{ paddingBottom: 12 }} key={"" + index}>
          <Col span={12}>
            <Tooltip title="Make sure the port is not already used!">
              <Input
                addonBefore="Server Port"
                placeholder="5050"
                value={value.hostPort ? value.hostPort + "" : ""}
                type="number"
                onChange={e => {
                  const newApiData = Utils.copyObject(self.props.apiData);
                  const p = Number(e.target.value.trim());
                  newApiData.appDefinition.ports[index].hostPort =
                    p > 0 ? p : 0; // to avoid NaN
                  self.props.updateApiData(newApiData);
                }}
              />
            </Tooltip>
          </Col>
          <Col style={{ paddingLeft: 12 }} span={12}>
            <Input
              addonBefore="Container Port"
              placeholder="6060"
              value={value.containerPort ? value.containerPort + "" : ""}
              onChange={e => {
                const newApiData = Utils.copyObject(self.props.apiData);
                const p = Number(e.target.value.trim());
                newApiData.appDefinition.ports[index].containerPort =
                  p > 0 ? p : 0; // to avoid NaN
                self.props.updateApiData(newApiData);
              }}
            />
          </Col>
        </Row>
      );
    });
  }

  createVolRows() {
    const self = this;
    const volumes = this.props.apiData.appDefinition.volumes || [];
    return volumes.map((value, index) => {
      return (
        <Row style={{ paddingBottom: 12 }} key={"" + index}>
          <Col span={8}>
            <Input
              addonBefore="Path in App"
              className="code-input"
              placeholder="/var/www/html"
              value={value.containerPath}
              type="text"
              onChange={e => {
                const newApiData = Utils.copyObject(self.props.apiData);
                newApiData.appDefinition.volumes[index].containerPath =
                  e.target.value;
                self.props.updateApiData(newApiData);
              }}
            />
          </Col>
          <Col
            style={{ paddingLeft: 12 }}
            span={8}
            className={value.hostPath ? "hide-on-demand" : ""}
          >
            <Input
              addonBefore="Label"
              className="code-input"
              placeholder="some-name"
              value={value.volumeName}
              onChange={e => {
                const newApiData = Utils.copyObject(self.props.apiData);
                newApiData.appDefinition.volumes[index].volumeName =
                  e.target.value;
                self.props.updateApiData(newApiData);
              }}
            />
          </Col>

          <Col
            style={{ paddingLeft: 12 }}
            span={8}
            className={!value.hostPath ? "hide-on-demand" : ""}
          >
            <Tooltip title="IMPORTANT: Ensure Host Path exists before assigning it here">
              <Input
                addonBefore="Path on Host"
                className="code-input"
                placeholder="/host/path/exists"
                value={value.hostPath}
                onChange={e => {
                  const newApiData = Utils.copyObject(self.props.apiData);
                  newApiData.appDefinition.volumes[index].hostPath =
                    e.target.value;
                  self.props.updateApiData(newApiData);
                }}
              />
            </Tooltip>
          </Col>
          <Col style={{ paddingLeft: 12 }} span={8}>
            <Button
              type="dashed"
              onClick={() => {
                const newApiData = Utils.copyObject(self.props.apiData);
                newApiData.appDefinition.volumes[index].hostPath = newApiData
                  .appDefinition.volumes[index].hostPath
                  ? ""
                  : "/";
                self.props.updateApiData(newApiData);
              }}
            >
              {value.hostPath
                ? "Let Captain manage path"
                : "Set specific host path"}
            </Button>
          </Col>
        </Row>
      );
    });
  }

  createVolSection() {
    const self = this;
    const app = this.props.apiData!.appDefinition;

    if (!app.hasPersistentData) return <div />;

    return (
      <div>
        <h4>
          Persistent Directories &nbsp;
          <a
            href="https://captainduckduck.com/docs/app-configuration.html#persistent-or-not"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon type="info-circle" />
          </a>
        </h4>
        <div
          className={
            app.volumes && !!app.volumes.length ? "hide-on-demand" : ""
          }
        >
          <i>Currently, this app does not have any persistent directories.</i>
        </div>

        {this.createVolRows()}
        <br />
        <Button type="default" onClick={() => this.addVolumeClicked()}>
          Add Persistent Directory
        </Button>
        <br />
        <br />
        <br />

        <Row>
          <Col span={6} style={{ width: 300 }}>
            <Tooltip title="Leave empty for automatic placement">
              <Input
                addonBefore="Node ID"
                className="code-input"
                value={app.nodeId ? app.nodeId : ""}
                disabled={!this.state.forceEditableNodeId}
                onChange={e => {
                  const newApiData = Utils.copyObject(self.props.apiData);
                  newApiData.appDefinition.nodeId = e.target.value;
                  self.props.updateApiData(newApiData);
                }}
              />
            </Tooltip>
          </Col>
          <Col span={12} style={{ paddingLeft: 24 }}>
            <Tooltip title="WARNING: Changing Node ID causes the content of your persistent directories to be deleted!">
              <Button
                type="default"
                disabled={this.state.forceEditableNodeId}
                onClick={() => this.setState({ forceEditableNodeId: true })}
              >
                Edit
              </Button>
            </Tooltip>
          </Col>
        </Row>

        <br />
        <br />
      </div>
    );
  }

  render() {
    const app = this.props.apiData!.appDefinition;
    return (
      <div>
        <h4>Environmental Variables:</h4>
        <div
          className={
            app.envVars && !!app.envVars.length ? "hide-on-demand" : ""
          }
        >
          <i>
            Currently, this app does not have any custom environmental variables
            yet.
          </i>
        </div>

        {this.createEnvVarRows()}

        <br />

        <Button type="default" onClick={() => this.addEnvVarClicked()}>
          Add Key/Value Pair
        </Button>

        <br />
        <br />
        <br />

        <h4>
          Port Mapping &nbsp;
          <a
            href="https://captainduckduck.com/docs/app-configuration.html#port-mapping"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon type="info-circle" />
          </a>
        </h4>
        <div
          className={app.ports && !!app.ports.length ? "hide-on-demand" : ""}
        >
          <i>Currently, this app does not have any custom port mapping.</i>
        </div>

        {this.createPortRows()}

        <br />

        <Button type="default" onClick={() => this.addPortMappingClicked()}>
          Add Port Mapping
        </Button>
        <br />
        <br />
        <br />
        {this.createVolSection()}
        <br />
        <Row>
          <Col span={6} style={{ width: 300 }}>
            <Tooltip title="Number of running instances of this app">
              <Input
                addonBefore="Instance Count"
                type="number"
                defaultValue={app.instanceCount + ""}
                disabled={
                  app.hasPersistentData &&
                  !this.state.forceEditableInstanceCount
                }
                onChange={e => {
                  const newApiData = Utils.copyObject(this.props.apiData);
                  newApiData.appDefinition.instanceCount = Number(
                    e.target.value
                  );
                  this.props.updateApiData(newApiData);
                }}
              />
            </Tooltip>
          </Col>
          <Col span={6}>
            <div
              style={{ paddingLeft: 24 }}
              className={!app.hasPersistentData ? "hide-on-demand" : ""}
            >
              <Tooltip title="Multiple instances of apps with persistent data can be very dangerous and bug prone as they can be accessing the same file on the disk resulting in data corruption. Edit the instance count only if you understand the risk.">
                <Button
                  type="default"
                  disabled={this.state.forceEditableInstanceCount}
                  onClick={() =>
                    this.setState({ forceEditableInstanceCount: true })
                  }
                >
                  Edit
                </Button>
              </Tooltip>
            </div>
          </Col>
        </Row>

        <Row>
          <br />
          <br />
          <br />
          <h4>
            Pre-Deploy Script
            <a
              style={{ paddingLeft: 10 }}
              href="https://captainduckduck.com/docs/pre-deploy-script.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon type="info-circle" />
            </a>
          </h4>

          <Input.TextArea
            spellCheck={false}
            autoCorrect="off"
            autoComplete="off"
            autoCapitalize="off"
            className="code-input"
            placeholder="var preDeployFunction = function (captainAppObj, dockerUpdateObject) ..."
            rows={4}
            value={app.preDeployFunction ? app.preDeployFunction : ""}
            onChange={e => {
              const newApiData = Utils.copyObject(this.props.apiData);
              newApiData.appDefinition.preDeployFunction = e.target.value;
              this.props.updateApiData(newApiData);
            }}
          />
        </Row>
      </div>
    );
  }

  addPortMappingClicked() {
    const newApiData = Utils.copyObject(this.props.apiData);
    newApiData.appDefinition.ports = newApiData.appDefinition.ports || {};
    newApiData.appDefinition.ports.push({
      containerPort: 0,
      hostPort: 0
    });
    this.props.updateApiData(newApiData);
  }

  addEnvVarClicked() {
    const newApiData = Utils.copyObject(this.props.apiData);
    newApiData.appDefinition.envVars = newApiData.appDefinition.envVars || {};
    newApiData.appDefinition.envVars.push({
      key: "",
      value: ""
    });
    this.props.updateApiData(newApiData);
  }

  addVolumeClicked() {
    const newApiData = Utils.copyObject(this.props.apiData);
    newApiData.appDefinition.volumes = newApiData.appDefinition.volumes || {};
    newApiData.appDefinition.volumes.push({
      containerPath: "",
      volumeName: ""
    });
    this.props.updateApiData(newApiData);
  }

  reFetchData() {
    this.props.reFetchData();
  }
}
