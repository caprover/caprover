import React, { Component } from "react";
import {
  Row,
  Col,
  Card,
  Checkbox,
  Button,
  Icon,
  Tooltip,
  Input,
  Table
} from "antd";
import ApiComponent from "../global/ApiComponent";
import Toaster from "../../utils/Toaster";
import Search from "antd/lib/input/Search";
import CenteredSpinner from "../global/CenteredSpinner";
import { IAppDef } from "./AppDefinition";
import ClickableLink from "../global/ClickableLink";

export default class AppsTable extends Component<
  {
    apps: IAppDef[];
    rootDomain: string;
    defaultNginxConfig: string;
  },
  { searchTerm: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { searchTerm: "" };
  }

  onAppClicked(appName: string) {
    //
  }

  createColumns() {
    const self = this;
    const ALIGN: "center" = "center";
    return [
      {
        title: "App Name",
        dataIndex: "appName",
        key: "appName",
        render: (appName: string) => (
          <ClickableLink onLinkClicked={() => self.onAppClicked(appName)}>
            {appName}
          </ClickableLink>
        )
      },
      {
        title: "Persistent Data	",
        dataIndex: "hasPersistentData",
        key: "hasPersistentData",
        align: ALIGN,
        render: (hasPersistentData: boolean) => {
          if (!hasPersistentData) {
            return <span />;
          }

          return (
            <span>
              <Icon type="check" />
            </span>
          );
        }
      },
      {
        title: "Exposed Webapp",
        dataIndex: "notExposeAsWebApp",
        key: "notExposeAsWebApp",
        align: ALIGN,
        render: (notExposeAsWebApp: boolean) => {
          if (!!notExposeAsWebApp) {
            return <span />;
          }

          return (
            <span>
              <Icon type="check" />
            </span>
          );
        }
      },
      {
        title: "Instance Count",
        dataIndex: "instanceCount",
        key: "instanceCount",
        align: ALIGN
      },
      {
        title: "Open in Browser",
        dataIndex: "notExposeAsWebApp",
        key: "openInBrowser",
        align: ALIGN,
        render: (notExposeAsWebApp: boolean, app: IAppDef) => {
          if (notExposeAsWebApp) {
            return <span />;
          }

          return (
            <a
              href={
                "http" +
                (app.hasDefaultSubDomainSsl ? "s" : "") +
                "://" +
                app.appName +
                "." +
                self.props.rootDomain
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon type="link" />{" "}
            </a>
          );
        }
      }
    ];
  }

  render() {
    const self = this;

    const appsToRender = self.props.apps.filter(app => {
      if (!self.state.searchTerm) return true;

      return app.appName!.indexOf(self.state.searchTerm) >= 0;
    });

    return (
      <Row>
        <Col span={18} offset={3} style={{ minHeight: 700 }}>
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
              <Table<IAppDef>
                rowKey="appName"
                columns={self.createColumns()}
                dataSource={appsToRender}
                pagination={false}
                size="middle"
              />
            </Row>
          </Card>
        </Col>
      </Row>
    );
  }
}
