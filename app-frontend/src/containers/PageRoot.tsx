import React, { Component } from "react";
import { RouteComponentProps, Switch, Route } from "react-router";
import ApiManager from "../api/ApiManager";
import { Layout, Menu, Breadcrumb, Icon, Row, Col, Card } from "antd";
import ClickableLink from "./global/ClickableLink";
import Dashboard from "./Dashboard";
import LoggedInCatchAll from "./LoggedInCatchAll";
import Settings from "./Settings";
import Nodes from "./Nodes";
import Monitoring from "./Monitoring";
import Apps from "./Apps/Apps";
import { SelectParam } from "antd/lib/menu";

const { Header, Content, Sider } = Layout;

export default class PageRoot extends Component<RouteComponentProps<any>> {
  componentDidMount() {
    if (!ApiManager.isLoggedIn()) {
      this.props.history.push("/login");
    }
  }

  onSelectMenu(param: SelectParam) {
    this.props.history.push("/" + param.key);
  }

  render() {
    const self = this;
    return (
      <Layout className="full-screen-bg">
        <Header className="header">
          <ClickableLink
            onLinkClicked={() => {
              this.props.history.push("/");
            }}
          >
            <img
              src="/favicon.ico"
              style={{
                marginRight: 10
              }}
            />
            CaptainDuckDuck
          </ClickableLink>
        </Header>
        <Layout>
          <Sider width={200} style={{ background: "#fff" }}>
            <Menu
              onSelect={(param: SelectParam) => {
                self.onSelectMenu(param);
              }}
              theme="dark"
              mode="inline"
              defaultSelectedKeys={["dashboard"]}
              style={{ height: "100%", borderRight: 0 }}
            >
              <Menu.Item key="dashboard">
                <span>
                  <Icon type="laptop" />
                  Dashboard
                </span>
              </Menu.Item>
              <Menu.Item key="apps">
                <span>
                  <Icon type="code" />
                  Apps
                </span>
              </Menu.Item>
              <Menu.Item key="monitoring">
                <span>
                  <Icon type="dashboard" />
                  Monitoring
                </span>
              </Menu.Item>
              <Menu.Item key="nodes">
                <span>
                  <Icon type="cluster" />
                  Nodes
                </span>
              </Menu.Item>
              <Menu.Item key="settings">
                <span>
                  <Icon type="setting" />
                  Settings
                </span>
              </Menu.Item>
            </Menu>
          </Sider>
          <Layout style={{ paddingTop: 12, paddingBottom: 36 }}>
            <Switch>
              <Route path="/dashboard/" component={Dashboard} />
              <Route path="/apps/" component={Apps} />
              <Route path="/monitoring/" component={Monitoring} />
              <Route path="/nodes/" component={Nodes} />
              <Route path="/settings/" component={Settings} />
              <Route path="/" component={LoggedInCatchAll} />
            </Switch>
          </Layout>
        </Layout>
      </Layout>
    );
  }
}
