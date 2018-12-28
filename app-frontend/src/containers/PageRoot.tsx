import React, { Component, ReactElement, RefObject, Fragment } from "react";
import { RouteComponentProps, Switch, Route } from "react-router";
import ApiManager from "../api/ApiManager";
import { Layout, Menu, Breadcrumb, Icon, Row, Col, Card } from "antd";
import ClickableLink from "./global/ClickableLink";
import Dashboard from "./Dashboard";
import LoggedInCatchAll from "./LoggedInCatchAll";
import Cluster from "./nodes/Cluster";
import Apps from "./apps/Apps";
import { SelectParam } from "antd/lib/menu";
import AppDetails from "./apps/appDetails/AppDetails";
import Monitoring from "./monitoring/Monitoring";
import Settings from "./settings/Settings";
import OneClickAppSelector from "./apps/oneclick/OneClickAppSelector";
import OneClickAppConfigPage from "./apps/oneclick/OneClickAppConfigPage";
import ApiComponent from "./global/ApiComponent";
import Toaster from "../utils/Toaster";
import { IVersionInfo } from "../models/IVersionInfo";

const { Header, Content, Sider } = Layout;

export default class PageRoot extends ApiComponent<
  RouteComponentProps<any>,
  {
    versionInfo: IVersionInfo | undefined;
  }
> {
  private mainContainer: RefObject<HTMLDivElement>;

  constructor(props: any) {
    super(props);
    this.mainContainer = React.createRef();
    this.state = {
      versionInfo: undefined
    };
  }

  componentDidMount() {
    const self = this;

    if (!ApiManager.isLoggedIn()) {
      this.props.history.push("/login");
    } else {
      this.apiManager
        .getVersionInfo()
        .then(function(data) {
          self.setState({ versionInfo: data });
        })
        .catch(Toaster.createCatcher());
    }
  }

  createUpdateAvailableIfNeeded() {
    const self = this;

    if (!self.state.versionInfo || !self.state.versionInfo.canUpdate) {
      return <span />;
    }

    return (
      <Fragment>
        <ClickableLink
          onLinkClicked={() => self.props.history.push("/settings")}
        >
          <Icon
            type="gift"
            theme="twoTone"
            style={{
              marginLeft: 50
            }}
          />
          <Icon
            type="gift"
            theme="twoTone"
            style={{
              marginRight: 10,
              marginLeft: 3
            }}
          />
          Update Available!
          <Icon
            type="gift"
            theme="twoTone"
            style={{
              marginLeft: 10
            }}
          />
          <Icon
            type="gift"
            theme="twoTone"
            style={{
              marginLeft: 3
            }}
          />
        </ClickableLink>
      </Fragment>
    );
  }

  onSelectMenu(param: SelectParam) {
    this.props.history.push("/" + param.key);
  }

  render() {
    const self = this;
    return (
      <Layout className="full-screen-bg">
        <Header className="header">
          <div>
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
            {self.createUpdateAvailableIfNeeded()}
          </div>
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
              <Menu.Item key="cluster">
                <span>
                  <Icon type="cluster" />
                  Cluster
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
          <Content>
            <div
              ref={self.mainContainer}
              style={{
                paddingTop: 12,
                paddingBottom: 36,
                height: "100%",
                overflowY: "scroll"
              }}
              id="main-content-layout"
            >
              <Switch>
                <Route path="/dashboard/" component={Dashboard} />
                <Route
                  path="/apps/details/:appName"
                  render={props => (
                    <AppDetails {...props} mainContainer={self.mainContainer} />
                  )}
                />
                <Route
                  path="/apps/oneclick/:appName"
                  component={OneClickAppConfigPage}
                />
                <Route path="/apps/oneclick" component={OneClickAppSelector} />
                <Route path="/apps/" component={Apps} />
                <Route path="/monitoring/" component={Monitoring} />
                <Route path="/cluster/" component={Cluster} />
                <Route path="/settings/" component={Settings} />
                <Route path="/" component={LoggedInCatchAll} />
              </Switch>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }
}
