import React, { Component } from "react";
import ApiComponent from "../global/ApiComponent";
import { Card, Col, Row, Button, Icon, message } from "antd";
import Toaster from "../../utils/Toaster";
import CenteredSpinner from "../global/CenteredSpinner";
import NetDataDescription from "./NetDataDescription";
import NetDataSettingsForm from "./NetDataSettingsForm";
import Utils from "../../utils/Utils";
import ErrorRetry from "../global/ErrorRetry";

export default class NetDataInfo extends ApiComponent<
  {},
  { apiData: any; isLoading: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      apiData: undefined,
      isLoading: true
    };
  }

  componentDidMount() {
    this.refetchData();
  }

  refetchData() {
    const self = this;
    self.setState({ isLoading: true, apiData: undefined });
    return this.apiManager
      .getNetDataInfo()
      .then(function(data) {
        self.setState({ apiData: data });
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.setState({ isLoading: false });
      });
  }

  toggleNetDataClicked(isActivated: boolean) {
    const netDataInfo = Utils.copyObject(this.state.apiData);
    netDataInfo.isEnabled = !!isActivated;
    this.onUpdateNetDataClicked(netDataInfo);
  }

  onUpdateNetDataClicked(netDataInfo: any) {
    const self = this;
    self.setState({ isLoading: true });
    return this.apiManager
      .updateNetDataInfo(netDataInfo)
      .then(function() {
        message.success(
          netDataInfo.isEnabled
            ? "NetData is started and updated!"
            : "NetData has stopped!"
        );
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.refetchData();
      });
  }

  render() {
    const self = this;

    if (this.state.isLoading) {
      return <CenteredSpinner />;
    }

    if (!this.state.apiData) {
      return <ErrorRetry />;
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
                    onClick={() => self.toggleNetDataClicked(true)}
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
                    onClick={() => self.toggleNetDataClicked(false)}
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
                    onClick={() =>
                      self.onUpdateNetDataClicked(
                        Utils.copyObject(self.state.apiData)
                      )
                    }
                  >
                    Update NetData
                  </Button>
                </Row>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }
}
