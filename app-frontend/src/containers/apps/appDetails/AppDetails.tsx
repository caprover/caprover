import React, { Component, RefObject } from "react";
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
  Input,
  Affix,
  Modal
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
import Deployment from "./Deployment";
import Utils from "../../../utils/Utils";
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

interface PropsInterface extends RouteComponentProps<any> {
  mainContainer: RefObject<HTMLDivElement>;
}

export default class AppDetails extends ApiComponent<
  PropsInterface,
  {
    isLoading: boolean;
    apiData: SingleAppApiData | undefined;
    activeTabKey: string;
    renderCounterForAffixBug: number;
  }
> {
  private reRenderTriggered = false;
  private confirmedAppNameToDelete: string = "";

  constructor(props: any) {
    super(props);

    this.state = {
      activeTabKey: WEB_SETTINGS,
      isLoading: true,
      renderCounterForAffixBug: 0,
      apiData: undefined
    };
  }

  goBackToApps() {
    this.props.history.push("/apps");
  }

  onDeleteAppClicked() {
    const self = this;
    const appDef = Utils.copyObject(self.state.apiData!.appDefinition);

    self.confirmedAppNameToDelete = "";

    Modal.confirm({
      title: "Confirm Permanent Delete?",
      content: (
        <div>
          <p>
            You are about to delete <code>{appDef.appName}</code>. Please enter
            the name of this app in the box below to confirm deletation of this
            app. Please note that this is
            <b> not reversible</b>.
          </p>
          <p className={appDef.hasPersistentData ? "" : "hide-on-demand"}>
            <b>IMPORTANT:</b>
            <i> {appDef.appName}</i> is an app with persistent data. After
            deleting the app from CaptainDuckDuck, you will have to manually SSH
            to your server, and delete Persistent Directories on your server.
            Refer to the
            <a
              href="https://captainduckduck.com/docs/app-configuration.html#removing-persistent-apps"
              target="_blank"
              rel="noopener noreferrer"
            >
              documentations
            </a>
            for more details.
          </p>
          Confirm App Name:
          <Input
            type="text"
            placeholder={appDef.appName}
            onChange={e => {
              self.confirmedAppNameToDelete = e.target.value.trim();
            }}
          />
        </div>
      ),
      onOk() {
        if (self.confirmedAppNameToDelete !== appDef.appName) {
          message.warning("App name did not match. Cancel operation.");
          return;
        }

        self.setState({ isLoading: true });
        self.apiManager
          .deleteApp(appDef.appName!)
          .then(function() {
            message.success("App deleted!");
          })
          .then(function() {
            self.goBackToApps();
          })
          .catch(Toaster.createCatcher());
      },
      onCancel() {
        // do nothing
      }
    });
  }

  onUpdateConfigAndSave() {
    const self = this;
    const appDef = Utils.copyObject(self.state.apiData!.appDefinition);
    self.setState({ isLoading: true });
    this.apiManager
      .updateConfigAndSave(appDef.appName!, appDef)
      .then(function(data: any) {
        self.reFetchData();
      })
      .catch(Toaster.createCatcher());
  }

  render() {
    const self = this;

    if (self.state.isLoading) {
      return <CenteredSpinner />;
    }

    if (!self.reRenderTriggered) {
      //crazy hack to make sure the Affix is showing (delete and save & update)
      self.reRenderTriggered = true;
      setTimeout(function() {
        self.setState({ renderCounterForAffixBug: 1 });
      }, 50);
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
                <Deployment
                  setLoading={value => this.setState({ isLoading: value })}
                  reFetchData={() => this.reFetchData()}
                  apiData={this.state.apiData!}
                  apiManager={this.apiManager}
                  updateApiData={(newData: any) =>
                    this.setState({ apiData: newData })
                  }
                />
              </TabPane>
            </Tabs>
            <div style={{ height: 50 }} />

            <Affix
              offsetBottom={0}
              target={() => {
                const newLocal = self.props.mainContainer;
                return newLocal && newLocal.current ? newLocal.current : window;
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.8)",
                  paddingTop: 3,
                  paddingBottom: 20
                }}
              >
                <hr />
                <div style={{ height: 10 }} />
                <Row type="flex" justify="center" gutter={20}>
                  <Col span={8}>
                    <div style={{ textAlign: "center" }}>
                      <Button
                        style={{ minWidth: 135 }}
                        type="danger"
                        size="large"
                        onClick={() => self.onDeleteAppClicked()}
                      >
                        Delete App
                      </Button>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: "center" }}>
                      <Button
                        style={{ minWidth: 135 }}
                        type="primary"
                        size="large"
                        onClick={() => self.onUpdateConfigAndSave()}
                      >
                        Save &amp; Update
                      </Button>
                    </div>
                  </Col>
                </Row>
              </div>
            </Affix>
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
