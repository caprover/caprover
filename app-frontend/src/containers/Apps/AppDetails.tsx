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
import ApiComponent from "../global/ApiComponent";
import Toaster from "../../utils/Toaster";
import Search from "antd/lib/input/Search";
import CenteredSpinner from "../global/CenteredSpinner";
import { RouteComponentProps } from "react-router";
import { IAppDef } from "./AppDefinition";
import ClickableLink from "../global/ClickableLink";
import TextArea from "antd/lib/input/TextArea";
const TabPane = Tabs.TabPane;

const WEB_SETTINGS = "WEB_SETTINGS";
const APP_CONFIGS = "APP_CONFIGS";
const DEPLOYMENT = "DEPLOYMENT";

export default class AppDetails extends ApiComponent<
  RouteComponentProps<any>,
  {
    isLoading: boolean;
    rootDomain: string;
    apiData: IAppDef | undefined;
    activeTabKey: string;
    defaultNginxConfig: string;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      activeTabKey: WEB_SETTINGS,
      isLoading: true,
      apiData: undefined,
      defaultNginxConfig: "",
      rootDomain: ""
    };
  }

  getCopyOfAppObject() {
    return JSON.parse(JSON.stringify(this.state.apiData)) as IAppDef;
  }

  goBackToApps() {
    this.props.history.push("/apps");
  }

  createTabContent() {
    return (
      <Tabs
        defaultActiveKey={WEB_SETTINGS}
        // onChange={key => console.log(key)}
      >
        <TabPane
          tab={<span className="unselectable-span">HTTP Settings</span>}
          key={WEB_SETTINGS}
        >
          {this.createHttpSettingsContent()}
        </TabPane>
        <TabPane
          tab={<span className="unselectable-span">App Configs</span>}
          key={APP_CONFIGS}
        >
          {this.createAppConfigsContent()}
        </TabPane>
        <TabPane
          tab={<span className="unselectable-span">Deployment</span>}
          key={DEPLOYMENT}
        >
          {this.createDeploymentContent()}
        </TabPane>
      </Tabs>
    );
  }

  enableDefaultHttps() {
    const self = this;
    this.setState({ isLoading: true });

    return Promise.resolve()
      .then(function() {
        return self.apiManager.enableSslForBaseDomain(
          self.state.apiData!.appName!
        );
      })
      .then(function() {
        message.success("HTTPS is now enabled for your app");
      })
      .then(function() {
        self.reFetchData();
      })
      .catch(Toaster.createCatcher());
  }

  onConnectNewDomainClicked(newDomain: string) {
    const self = this;
    this.setState({ isLoading: true });

    return Promise.resolve()
      .then(function() {
        return self.apiManager.attachNewCustomDomainToApp(
          self.state.apiData!.appName!,
          newDomain
        );
      })
      .then(function() {
        message.success("New domain is now successfully connected!");
      })
      .then(function() {
        self.reFetchData();
      })
      .catch(Toaster.createCatcher());
  }

  onEnableCustomDomainSslClicked(appName: string, customDomain: string) {
    // TODO
  }

  onRemoveCustomDomainClicked(appName: string, customDomain: string) {
    // TODO
  }

  createCustomDomainRows() {
    const customDomains = this.state.apiData!.customDomain || [];
    const appName = this.state.apiData!.appName!;

    const rows: JSX.Element[] = [];
    customDomains.forEach(c => {
      const row = (
        <Row key={c.publicDomain} style={{ marginTop: 15 }}>
          <Button.Group size="small">
            <Button
              disabled={c.hasSsl}
              onClick={() => {
                this.onEnableCustomDomainSslClicked(appName, c.publicDomain);
              }}
              type="primary"
            >
              Enable HTTPS
            </Button>
            <Button
              style={{ marginRight: 20 }}
              onClick={() => {
                this.onRemoveCustomDomainClicked(appName, c.publicDomain);
              }}
            >
              Remove
            </Button>
          </Button.Group>

          <a
            target="_blank"
            rel="noopener noreferrer"
            href={"http://" + c.publicDomain}
          >
            {c.publicDomain}
          </a>
        </Row>
      );
      rows.push(row);
    });

    return rows;
  }

  onEditDefaultNginxConfigClicked() {
    const newApp = this.getCopyOfAppObject();
    newApp.customNginxConfig = this.state.defaultNginxConfig;
    this.setState({
      apiData: newApp
    });
  }

  createCustomNginx() {
    const customNginxConfig = this.state.apiData!.customNginxConfig!;
    if (!customNginxConfig) {
      return (
        <div>
          <Button
            type="default"
            onClick={() => this.onEditDefaultNginxConfigClicked()}
          >
            Edit Default Nginx Configurations
          </Button>
        </div>
      );
    }

    return (
      <div>
        <p>
          Note that templates are build using EJS template pattern. Do not
          change the areas between &lt;&percnt; and &percnt;&gt; unless you
          really know what you're doing! To revert to default, simply remove all
          the content.
        </p>
        <Input.TextArea
          style={{
            fontFamily: "monospace"
          }}
          onChange={e => {
            const app = this.getCopyOfAppObject();
            app.customNginxConfig = e.target.value;
            this.setState({
              apiData: app
            });
          }}
          rows={17}
          defaultValue={customNginxConfig}
        />
      </div>
    );
  }

  createHttpDetailsSettingsContent() {
    const app = this.state.apiData!;
    const rootDomain = this.state.rootDomain;

    return (
      <div>
        <Row>
          <p>Your app is available to public at:</p>
          <Button
            disabled={app.hasDefaultSubDomainSsl}
            style={{ marginRight: 20 }}
            onClick={() => {
              this.enableDefaultHttps();
            }}
            type="primary"
          >
            Enable HTTPS
          </Button>
          <a
            href={
              "http" +
              (app.hasDefaultSubDomainSsl ? "s" : "") +
              "://" +
              app.appName +
              "." +
              rootDomain
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {"http" +
              (app.hasDefaultSubDomainSsl ? "s" : "") +
              "://" +
              app.appName +
              "." +
              rootDomain}
          </a>
        </Row>
        <br />
        <hr />
        <br />
        <Row>
          <Col span={15}>
            <Search
              placeholder="www.the-best-app-in-the-world.com"
              enterButton="Connect New Domain"
              onSearch={value => this.onConnectNewDomainClicked(value)}
            />
          </Col>
          &nbsp;&nbsp;&nbsp;
          <Tooltip title="Make sure the new domain points to this IP, otherwise verification will fail.">
            <span>
              <Icon style={{ marginTop: 9 }} type="info-circle" />
            </span>
          </Tooltip>
        </Row>

        <br />
        {this.createCustomDomainRows()}
        <br />
        <br />
        {this.createCustomNginx()}
        <br />
        <br />

        <Checkbox
          onChange={(e: any) => {
            const newApp = this.getCopyOfAppObject();
            newApp.forceSsl = !!e.target.checked;
            this.setState({ apiData: newApp });
          }}
        >
          Enforce HTTPS by redirecting all HTTP traffic to HTTPS
        </Checkbox>
      </div>
    );
  }

  createHttpSettingsContent() {
    const app = this.state.apiData!;
    return (
      <div>
        <p>
          Your app is internally available as{" "}
          <code>srv-captain--{app.appName}</code> to other Captain apps. In case
          of web-app, it is accessible via{" "}
          <code>{"http://srv-captain--" + app.appName}</code> from other apps.
        </p>
        <br />

        <Checkbox
          onChange={(e: any) => {
            const newApp = this.getCopyOfAppObject();
            newApp.notExposeAsWebApp = !!e.target.checked;
            this.setState({ apiData: newApp });
          }}
        >
          Do not expose as web-app
        </Checkbox>
        <Tooltip title="Use this if you don't want your app be externally available.">
          <Icon type="info-circle" />
        </Tooltip>

        <div style={{ height: 35 }} />
        {app.notExposeAsWebApp ? (
          <div />
        ) : (
          this.createHttpDetailsSettingsContent()
        )}
      </div>
    );
  }
  createAppConfigsContent() {
    return (
      <div>
        <p>createAppConfigsContent</p>
      </div>
    );
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

    const app = self.state.apiData!;

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
            {this.createTabContent()}
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
              apiData: element,
              rootDomain: data.rootDomain,
              defaultNginxConfig: data.defaultNginxConfig
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
