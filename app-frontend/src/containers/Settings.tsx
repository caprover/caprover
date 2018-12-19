import React, { Component } from "react";
import { Row, Col, Card } from "antd";

export default class Settings extends Component {
  render() {
    return (
      <Row>
        <Col span={14} offset={5}>
          <Card title="Settings">col 8</Card>
        </Col>
      </Row>
    );
  }
  componentDidMount() {}
}
