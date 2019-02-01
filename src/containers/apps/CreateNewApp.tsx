import React, { Component } from "react";
import { Row, Col, Card, Checkbox, Button, Icon, Tooltip } from "antd";
import ApiComponent from "../global/ApiComponent";
import Toaster from "../../utils/Toaster";
import Search from "antd/lib/input/Search";
import CenteredSpinner from "../global/CenteredSpinner";

export default class CreateNewApp extends Component<
  {
    onCreateNewAppClicked: (appName: string, hasPersistency: boolean) => void;
    onCreateOneClickAppClicked: () => void;
  },
  { appName: string; hasPersistency: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      hasPersistency: false,
      appName: ""
    };
  }

  onCreateNewAppClicked() {
    this.props.onCreateNewAppClicked(
      this.state.appName,
      this.state.hasPersistency
    );
  }

  onCreateOneClickAppClicked() {
    this.props.onCreateOneClickAppClicked();
  }

  render() {
    const self = this;

    return (
      <Row>
        <Col span={10} offset={7}>
          <Card
            title={
              <span>
                <Icon type="plus-circle" />
                &nbsp;&nbsp;&nbsp;Create A New App
              </span>
            }
          >
            <Row>
              <Search
                placeholder="my-amazing-app"
                enterButton="Create New App"
                onChange={e => self.setState({ appName: e.target.value })}
                onSearch={value => self.onCreateNewAppClicked()}
              />
            </Row>
            <br />
            <Row type="flex" justify="end">
              <Checkbox
                onChange={(e: any) =>
                  self.setState({ hasPersistency: !!e.target.checked })
                }
              >
                Has Persistent Data
              </Checkbox>
              &nbsp;&nbsp;
              <Tooltip title="Mostly used for databases, see docs for details.">
                <a
                  href="https://caprover.com/docs/persistent-apps.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>
                    <Icon type="question-circle" theme="filled" />
                  </span>
                </a>
              </Tooltip>
            </Row>

            <br />

            <hr />

            <br />
            <div style={{ textAlign: "center" }}>
              <p>Or Select From</p>
              <Button onClick={() => self.onCreateOneClickAppClicked()}>
                One-Click Apps/Databases
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    );
  }
}
