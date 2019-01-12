import React, { Component } from "react";
import { IDeploymentState } from "./OneClickAppDeployManager";
import { Row, Col, Card, Steps, Icon, Button, Alert } from "antd";

const Step = Steps.Step;

export default class OneClickAppDeployProgress extends Component<{
  appName: string;
  deploymentState: IDeploymentState;
  onRestartClicked: () => void;
  onFinishClicked: () => void;
}> {
  createSteps() {
    const steps = this.props.deploymentState.steps;
    const stepsInfo = [];

    for (let index = 0; index < steps.length; index++) {
      stepsInfo.push({
        text: (
          <span>
            <span>
              {index === this.props.deploymentState.currentStep &&
              !this.props.deploymentState.error ? (
                <Icon
                  style={{ fontSize: "16px", paddingRight: 12 }}
                  type="loading"
                />
              ) : (
                <span />
              )}
            </span>
            {steps[index]}
          </span>
        ),
        icon: undefined
      });
    }

    return stepsInfo.map(s => {
      return <Step icon={s.icon} title={s.text} />;
    });
  }

  render() {
    const self = this;

    return (
      <div>
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
                  <Steps
                    status={
                      !!self.props.deploymentState.error ? "error" : undefined
                    }
                    direction="vertical"
                    current={self.props.deploymentState.currentStep}
                  >
                    {self.createSteps()}
                  </Steps>

                  <div
                    className={
                      !!self.props.deploymentState.successMessage
                        ? ""
                        : "hide-on-demand"
                    }
                  >
                    <div style={{ height: 20 }} />
                    <Alert
                      showIcon
                      type="success"
                      message={
                        <div style={{ whiteSpace: "pre-line" }}>
                          {self.props.deploymentState.successMessage}
                        </div>
                      }
                    />
                    <div style={{ height: 80 }} />
                    <Row type="flex" justify="end">
                      <Button
                        style={{ minWidth: 150 }}
                        size="large"
                        type="primary"
                        onClick={() => self.props.onFinishClicked()}
                      >
                        Finish
                      </Button>
                    </Row>
                  </div>

                  <div
                    className={
                      !!self.props.deploymentState.error ? "" : "hide-on-demand"
                    }
                  >
                    <div style={{ height: 20 }} />
                    <Alert
                      showIcon
                      type="error"
                      message={self.props.deploymentState.error}
                    />
                    <div style={{ height: 80 }} />

                    <Row type="flex" justify="end">
                      <Button
                        size="large"
                        type="primary"
                        onClick={() => self.props.onRestartClicked()}
                      >
                        Go Back &amp; Try Again
                      </Button>
                    </Row>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}
