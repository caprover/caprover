import React, { Component } from "react";
import { Row, Col, Card } from "antd";
import DockerRegistries from "./DockerRegistries";
import AddNode from "./AddNode";
import CurrentNodes from "./CurrentNodes";

export default class Nodes extends Component {
  render() {
    return (
      <div>
        <Row type="flex" justify="center">
          <Col span={20}>
            <Card title="Docker Registry Configuration">
              <DockerRegistries />
            </Card>
          </Col>
        </Row>
        <div style={{ height: 35 }} />
        <Row type="flex" justify="center">
          <Col span={14}>
            <Card title="Attach a New Node">
              <AddNode />
            </Card>
          </Col>
        </Row>
        <div style={{ height: 35 }} />
        <Row type="flex" justify="center">
          <Col span={14}>
            <Card title="Current Nodes">
              <CurrentNodes />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }
  componentDidMount() {}
}
