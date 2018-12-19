import React, { Component } from "react";
import { RouteComponentProps } from "react-router";
import ApiManager from "../api/ApiManager";
import { Layout, Menu, Breadcrumb, Icon, Row, Col, Card } from "antd";
import ClickableLink from "./global/ClickableLink";

const { Header, Content, Sider } = Layout;

export default class PageRoot extends Component<RouteComponentProps<any>> {
  componentDidMount() {
    if (!ApiManager.isLoggedIn()) {
      this.props.history.push("/login");
    }
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
          <Layout style={{ padding: "0 12px 12px" }}>
            <Breadcrumb style={{ margin: "16px 0" }}>
              <Breadcrumb.Item>Home</Breadcrumb.Item>
              <Breadcrumb.Item>List</Breadcrumb.Item>
              <Breadcrumb.Item>App</Breadcrumb.Item>
            </Breadcrumb>
            <Content
              style={{
                //background: "#fff",
                padding: 12,
                margin: 0,
                minHeight: 280
              }}
            >
              <Row>
                <Col span={14} offset={5}>
                  <Card title="Captain Root Domain Configurations">col 8</Card>
                </Col>
              </Row>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    );
  }
}
