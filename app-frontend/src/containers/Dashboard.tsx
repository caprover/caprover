import React, { Component } from "react";
import { Row, Col, Card } from "antd";

export default class Dashboard extends Component {
  render() {
    return (
      <Row>
        <Col span={14} offset={5}>
          <Card title="Dashboard">col 8</Card>
        </Col>
      </Row>
    );
  }
  componentDidMount() {}
}
