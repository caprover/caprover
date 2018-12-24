import React, { Component } from "react";
import { Row, Col, Card } from "antd";
import ChangePass from "./ChangePass";
import CheckUpdate from "./CheckUpdate";
import NginxConfig from "./NginxConfig";
import DiskCleanup from "./DiskCleanup";

export default class Settings extends Component {
  render() {
    return (
      <div>
        <Row type="flex" justify="space-around">
          <Col span={12}>
            <div style={{ margin: 10 }}>
              <Card title="Change Password">
                <ChangePass />
              </Card>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ margin: 10 }}>
              <Card title="Check for Updates">
                <CheckUpdate />
              </Card>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ margin: 10 }}>
              <Card title="NGINX Configurations">
                <NginxConfig />
              </Card>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ margin: 10 }}>
              <Card title="Disk Cleanup">
                <DiskCleanup />
              </Card>
            </div>
          </Col>
        </Row>
      </div>
    );
  }
}
