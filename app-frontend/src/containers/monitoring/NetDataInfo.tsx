import React, { Component } from "react";
import ApiComponent from "../global/ApiComponent";
import { Card, Col, Row, Button, Icon } from "antd";
import Toaster from "../../utils/Toaster";
import CenteredSpinner from "../global/CenteredSpinner";
import NetDataDescription from "./NetDataDescription";
import NetDataSettingsForm from "./NetDataSettingsForm";

export default class NetDataInfo extends ApiComponent<{}, { apiData: any }> {
  constructor(props: any) {
    super(props);
    this.state = {
      apiData: undefined
    };
  }

  componentDidMount() {
    this.refetchData();
  }

  refetchData() {
    const self = this;
    this.apiManager
      .getNetDataInfo()
      .then(function(data) {
        self.setState({ apiData: data });
      })
      .catch(Toaster.createCatcher());
  }

  onStopNetDataClicked() {
    //
  }

  onStartNetDataClicked() {
    //
  }

  onUpdateNetDataClicked() {
    //
  }

  render() {
    const self = this;

    if (!this.state.apiData) {
      return <CenteredSpinner />;
    }

    const netDataInfo = this.state.apiData;

    return (
      <div>
        <Row>
          <Col span={18} offset={3}>
            <Card title="NetData Monitoring Tool">
              <NetDataDescription />
              <hr />
              <div style={{ height: 30 }} />
              <div className={netDataInfo.isEnabled ? "hide-on-demand" : ""}>
                <Row type="flex" justify="end">
                  <Button
                    onClick={() => self.onStartNetDataClicked()}
                    type="primary"
                  >
                    <span>
                      Start NetData Engine &nbsp;
                      <Icon type="poweroff" />
                    </span>
                  </Button>
                </Row>
              </div>

              <div className={!netDataInfo.isEnabled ? "hide-on-demand" : ""}>
                <Row type="flex" justify="end">
                  <Button
                    style={{ marginRight: 50 }}
                    onClick={() => self.onStopNetDataClicked()}
                    type="danger"
                  >
                    <span>
                      Turn NetData Off &nbsp;
                      <Icon type="poweroff" />
                    </span>
                  </Button>

                  <a
                    type="submit"
                    href={"//" + netDataInfo.netDataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button
                      //onClick={() => self.onStartNetDataClicked()}
                      type="primary"
                    >
                      <span>
                        Open NetData &nbsp;
                        <Icon type="area-chart" />
                      </span>
                    </Button>
                  </a>
                </Row>
              </div>
              <div style={{ height: 30 }} />
              <hr />
              <div style={{ height: 30 }} />
              <NetDataSettingsForm
                updateModel={netDataInfo => {
                  self.setState({ apiData: netDataInfo });
                }}
                netDataInfo={netDataInfo}
              />

              <br />

              <Row type="flex" justify="end">
                <Button
                  type="primary"
                  onClick={() => self.onUpdateNetDataClicked()}
                >
                  Update NetData
                </Button>
              </Row>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }
}
