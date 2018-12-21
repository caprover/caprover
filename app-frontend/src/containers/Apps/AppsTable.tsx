import React, { Component } from "react";
import { Row, Col, Card, Checkbox, Button, Icon, Tooltip, Input } from "antd";
import ApiComponent from "../global/ApiComponent";
import Toaster from "../../utils/Toaster";
import Search from "antd/lib/input/Search";
import CenteredSpinner from "../global/CenteredSpinner";

export default class AppsTable extends Component<
  {
    apps: any[];
  },
  { searchTerm: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { searchTerm: "" };
  }

  render() {
    const self = this;

    return (
      <Row>
        <Col span={18} offset={3}>
          <Card
            extra={
              <Input
                placeholder="Search by Name"
                type="text"
                onChange={event =>
                  self.setState({
                    searchTerm: (event.target.value || "").trim()
                  })
                }
              />
            }
            title={
              <span>
                <Icon type="code" />
                &nbsp;&nbsp;&nbsp;Your Apps
              </span>
            }
          >
            <Row>
              <pre>Apps:{JSON.stringify(self.props.apps, null, 2)}</pre>
            </Row>
          </Card>
        </Col>
      </Row>
    );
  }
}
