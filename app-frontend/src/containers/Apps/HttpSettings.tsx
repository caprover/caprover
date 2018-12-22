import React, { Component } from "react";
import {
  message,
  Row,
  Button,
  Input,
  Col,
  Icon,
  Tooltip,
  Checkbox
} from "antd";
import Toaster from "../../utils/Toaster";
import Utils from "../../utils/Utils";
import { AppDetailsTabProps } from "./AppDetails";

const Search = Input.Search;

export default class HttpSettings extends Component<
  AppDetailsTabProps,
  { dummyVar: undefined }
> {
  constructor(props: any) {
    super(props);
  }

  render() {
    return <div>{this.createHttpSettingsContent()}</div>;
  }

  reFetchData() {
    this.props.reFetchData();
  }

  enableDefaultHttps() {
    const self = this;
    this.props.setLoading(true);

    return Promise.resolve()
      .then(function() {
        return self.props.apiManager.enableSslForBaseDomain(
          self.props.apiData!.appDefinition.appName!
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
    this.props.setLoading(true);

    return Promise.resolve()
      .then(function() {
        return self.props.apiManager.attachNewCustomDomainToApp(
          self.props.apiData!.appDefinition.appName!,
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
    const customDomains = this.props.apiData!.appDefinition.customDomain || [];
    const appName = this.props.apiData!.appDefinition.appName!;

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
    const newApiData = Utils.copyObject(this.props.apiData!);
    newApiData.appDefinition.customNginxConfig = this.props.apiData!.defaultNginxConfig;
    this.props.updateApiData(newApiData);
  }

  createCustomNginx() {
    const customNginxConfig = this.props.apiData!.appDefinition
      .customNginxConfig!;
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
            const newApiData = Utils.copyObject(this.props.apiData!);
            newApiData.appDefinition.customNginxConfig = e.target.value;
            this.props.updateApiData(newApiData);
          }}
          rows={17}
          defaultValue={customNginxConfig}
        />
      </div>
    );
  }

  createHttpDetailsSettingsContent() {
    const app = this.props.apiData!.appDefinition;
    const rootDomain = this.props.apiData!.rootDomain;

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
            const newApiData = Utils.copyObject(this.props.apiData!);
            newApiData.appDefinition.forceSsl = !!e.target.checked;
            this.props.updateApiData(newApiData);
          }}
        >
          Enforce HTTPS by redirecting all HTTP traffic to HTTPS
        </Checkbox>
      </div>
    );
  }

  createHttpSettingsContent() {
    const app = this.props.apiData!.appDefinition;
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
            const newApiData = Utils.copyObject(this.props.apiData!);
            newApiData.appDefinition.notExposeAsWebApp = !!e.target.checked;
            this.props.updateApiData(newApiData);
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
}
