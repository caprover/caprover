import React, { Component } from "react";
import ApiComponent from "../../global/ApiComponent";
import OneClickAppsApi from "../../../api/OneClickAppsApi";
import Toaster from "../../../utils/Toaster";
import { Row, Col, Card, Select, Button, Icon } from "antd";
import CenteredSpinner from "../../global/CenteredSpinner";
import { RouteComponentProps } from "react-router";
import { IOneClickAppIdentifier } from "../../../models/IOneClickAppModels";

export default class OneClickAppSelector extends Component<
  RouteComponentProps<any>,
  {
    oneClickAppList: IOneClickAppIdentifier[] | undefined;
    selectedApp: string | undefined;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      oneClickAppList: undefined,
      selectedApp: undefined
    };
  }

  componentDidMount() {
    const self = this;
    new OneClickAppsApi()
      .getAllOneClickApps()
      .then(function(data) {
        self.setState({
          oneClickAppList: data
        });
      })
      .catch(Toaster.createCatcher());
  }

  createOptions() {
    return this.state.oneClickAppList!.map(app => {
      return (
        <Select.Option key={app.name} value={app.name}>
          {app.name}
        </Select.Option>
      );
    });
  }

  render() {
    const self = this;

    if (!this.state.oneClickAppList) return <CenteredSpinner />;

    return (
      <div>
        <Row type="flex" justify="center">
          <Col span={16}>
            <Card title="One Click Apps">
              <p>
                Choose an app, a database or a bundle (app+database) from the
                list below. The rest is magic, well... Wizard!
              </p>
              <p>
                One click apps are retrieved from :{" "}
                <a
                  href="https://github.com/caprover/one-click-apps"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  CapRover One Click Apps Repository
                </a>
              </p>
              <div style={{ height: 50 }} />
              <Row type="flex" justify="end" align="middle">
                <b>One-Click Apps List: &nbsp;&nbsp;</b>
                <Select
                  style={{ minWidth: 150 }}
                  onChange={value => {
                    self.setState({ selectedApp: value.toString() });
                  }}
                >
                  {self.createOptions()}
                </Select>
              </Row>
              <div style={{ height: 60 }} />{" "}
              <Row type="flex" justify="space-between" align="middle">
                <div>
                  <a
                    href="https://caprover.com/docs/one-click-apps.html#what-about-other-apps"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon type="info-circle" />
                  </a>
                  &nbsp; What if the app/database I want is not listed here?
                  &nbsp;
                </div>
                <Button
                  onClick={() =>
                    self.props.history.push(
                      `/apps/oneclick/${self.state.selectedApp}`
                    )
                  }
                  disabled={!self.state.selectedApp}
                  style={{ minWidth: 150 }}
                  type="primary"
                >
                  Next
                </Button>
              </Row>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }
}
