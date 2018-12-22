import React, { Component } from "react";
import {
  message,
  Row,
  Col,
  Card,
  Icon,
  Tooltip,
  Tabs,
  Checkbox,
  Button,
  Input
} from "antd";
import ApiComponent from "../../global/ApiComponent";
import Toaster from "../../../utils/Toaster";
import CenteredSpinner from "../../global/CenteredSpinner";
import { RouteComponentProps } from "react-router";
import { IAppDef } from "../AppDefinition";
import ClickableLink from "../../global/ClickableLink";
import HttpSettings from "./HttpSettings";
import ApiManager from "../../../api/ApiManager";
import AppConfigs from "./AppConfigs";
const TabPane = Tabs.TabPane;

const WEB_SETTINGS = "WEB_SETTINGS";
const APP_CONFIGS = "APP_CONFIGS";
const DEPLOYMENT = "DEPLOYMENT";

export interface SingleAppApiData {
  appDefinition: IAppDef;
  rootDomain: string;
  defaultNginxConfig: string;
}

export interface AppDetailsTabProps {
  apiData: SingleAppApiData;
  apiManager: ApiManager;
  updateApiData: Function;
  reFetchData: () => void;
  setLoading: (value: boolean) => void;
}

export default class AppDetails extends ApiComponent<
  RouteComponentProps<any>,
  {
    isLoading: boolean;
    apiData: SingleAppApiData | undefined;
    activeTabKey: string;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      activeTabKey: WEB_SETTINGS,
      isLoading: true,
      apiData: undefined
    };
  }

  goBackToApps() {
    this.props.history.push("/apps");
  }

  createDeploymentContent() {
    return (
      <div>
        <p>createDeploymentContent</p>
      </div>
    );
  }

  render() {
    const self = this;

    if (self.state.isLoading) {
      return <CenteredSpinner />;
    }

    const app = self.state.apiData!.appDefinition;

    return (
      <Row>
        <Col span={20} offset={2}>
          <Card
            extra={
              <ClickableLink onLinkClicked={() => self.goBackToApps()}>
                <Tooltip title="Close">
                  <Icon type="close" />
                </Tooltip>
              </ClickableLink>
            }
            title={
              <span>
                <Icon type="code" />
                &nbsp;&nbsp;&nbsp;{app.appName}
              </span>
            }
          >
            <Tabs
              defaultActiveKey={WEB_SETTINGS}
              // onChange={key => console.log(key)}
            >
              <TabPane
                tab={<span className="unselectable-span">HTTP Settings</span>}
                key={WEB_SETTINGS}
              >
                <HttpSettings
                  setLoading={value => this.setState({ isLoading: value })}
                  reFetchData={() => this.reFetchData()}
                  apiData={this.state.apiData!}
                  apiManager={this.apiManager}
                  updateApiData={(newData: any) =>
                    this.setState({ apiData: newData })
                  }
                />
              </TabPane>
              <TabPane
                tab={<span className="unselectable-span">App Configs</span>}
                key={APP_CONFIGS}
              >
                <AppConfigs
                  setLoading={value => this.setState({ isLoading: value })}
                  reFetchData={() => this.reFetchData()}
                  apiData={this.state.apiData!}
                  apiManager={this.apiManager}
                  updateApiData={(newData: any) =>
                    this.setState({ apiData: newData })
                  }
                />
              </TabPane>
              <TabPane
                tab={<span className="unselectable-span">Deployment</span>}
                key={DEPLOYMENT}
              >
                {this.createDeploymentContent()}
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>
    );
  }

  componentDidMount() {
    this.reFetchData();
  }

  reFetchData() {
    const self = this;
    self.setState({ isLoading: true });
    this.apiManager
      .getAllApps()
      .then(function(data: any) {
        for (let index = 0; index < data.appDefinitions.length; index++) {
          const element = data.appDefinitions[index];
          if (element.appName === self.props.match.params.appName) {
            self.setState({
              isLoading: false,
              apiData: {
                appDefinition: element,
                rootDomain: data.rootDomain,
                defaultNginxConfig: data.defaultNginxConfig
              }
            });
            return;
          }
        }

        // App Not Found!
        self.goBackToApps();
      })
      .catch(Toaster.createCatcher());
  }
}
