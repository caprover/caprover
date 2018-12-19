import React, { Component } from "react";
import { Row, Col, Card } from "antd";

export default class Monitoring extends Component {
  render() {
    return (
      <Row>
        <Col span={14} offset={5}>
          <Card title="Monitoring">col 8</Card>
        </Col>
      </Row>
    );
  }
  componentDidMount() {}
}
