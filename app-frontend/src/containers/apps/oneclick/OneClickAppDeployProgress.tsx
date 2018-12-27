import React, { Component } from "react";
import { IDeploymentState } from "./OneClickAppDeployHelper";
import { Row, Col, Card, Steps, Icon } from "antd";

const Step = Steps.Step;

export default class OneClickAppDeployProgress extends Component<{
  appName: string;
  deploymentState: IDeploymentState;
  onRestartClicked: () => void;
}> {
  render() {
    return (
      <div>
        <pre>{JSON.stringify(this.props.deploymentState, null, 2)}</pre>
        <div style={{ height: 40 }} />
        <div>
          <Row type="flex" justify="center">
            <Col span={16}>
              <Card title={`Deploying your ${this.props.appName}`}>
                <p>
                  This process takes a few minutes to complete. DO NOT refresh
                  this page and DO NOT navigate away!!!
                </p>
                <div style={{ padding: 20 }}>
                  <h3>Progress:</h3>
                  <div style={{ height: 20 }} />
                  <Steps direction="vertical" current={1}>
                    <Step
                      title="Registering App Name"
                      description="This is a description."
                    />
                    <Steps.Step
                      icon={<Icon type="loading" />}
                      title="Configuring App Name"
                      description="This is a description."
                    />
                    <Step
                      title="Deploying App Name"
                      description="This is a description."
                    />
                    <Step
                      title="Deploying App Name"
                      description="This is a description."
                    />
                    <Step
                      title="Deploying App Name"
                      description="This is a description."
                    />
                    <Step
                      title="Deploying App Name"
                      description="This is a description."
                    />
                  </Steps>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}
