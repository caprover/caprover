import React, { Component } from "react";
import { Button, Row } from "antd";
import { IRegistryInfo } from "../../models/IRegistryInfo";

export default class DockerRegistryAdd extends Component<{
  addDockerRegistry: (dockerRegistry: IRegistryInfo) => void;
}> {
  render() {
    return (
      <div>
        <Row type="flex" justify="end">
          <Button>Add Self-Hosted Registry</Button>
        </Row>

        <div style={{ height: 20 }} />
        <Row type="flex" justify="end">
          <Button>Add Remote Registry</Button>
        </Row>
      </div>
    );
  }
}
