import React, { Component } from "react";
import ApiComponent from "../global/ApiComponent";
import { Input, Icon, Row, Button, message, Modal } from "antd";
import Utils from "../../utils/Utils";
import CenteredSpinner from "../global/CenteredSpinner";
import Toaster from "../../utils/Toaster";
import ReloadCaptainModal from "./ReloadCaptainModal";
import ErrorRetry from "../global/ErrorRetry";

export default class NginxConfig extends ApiComponent<
  {},
  {
    nginxConfig: any;
    isLoading: boolean;
    isRefreshTimerActivated: boolean;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      isLoading: true,
      nginxConfig: undefined,
      isRefreshTimerActivated: false
    };
  }

  componentDidMount() {
    const self = this;
    self.setState({ isLoading: true });
    this.apiManager
      .getNginxConfig()
      .then(function(data) {
        self.setState({ nginxConfig: data });
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.setState({ isLoading: false });
      });
  }

  onLoadDefaultNginxConfigClicked() {
    const newApiData = Utils.copyObject(this.state.nginxConfig);
    newApiData.baseConfig.customValue = newApiData.baseConfig.byDefault;
    newApiData.captainConfig.customValue = newApiData.captainConfig.byDefault;
    this.setState({ nginxConfig: newApiData });
  }

  onUpdateNginxConfigClicked() {
    const self = this;
    const newApiData = Utils.copyObject(this.state.nginxConfig);
    self.setState({ isLoading: true });

    this.apiManager
      .setNginxConfig(
        newApiData.baseConfig.customValue,
        newApiData.captainConfig.customValue
      )
      .then(function() {
        self.setState({ isRefreshTimerActivated: true });
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.setState({ isLoading: false });
      });
  }

  render() {
    const self = this;
    if (self.state.isLoading) {
      return <CenteredSpinner />;
    }

    const nginxConfig = this.state.nginxConfig;

    if (!nginxConfig) {
      return <ErrorRetry />;
    }

    return (
      <div>
        <ReloadCaptainModal
          isRefreshTimerActivated={self.state.isRefreshTimerActivated}
        >
          <div>
            Nginx is successfully updated, CapRover will restart in 30 seconds.{" "}
            <b>Please wait until the page is automatically refreshed.</b>
            <br />
            <br />
          </div>
        </ReloadCaptainModal>{" "}
        <p>
          CapRover allows you to set custom configurations for your nginx
          router. This will allow high customization level in terms of caching,
          special routing, http2 and etc.
        </p>
        <p>
          Note that templates are build using EJS template pattern. Do not
          change the areas between <code>&lt;%</code> and <code>%&gt;</code>{" "}
          unless you really know what you're doing!
        </p>
        <br />
        <p>
          <b>Base Config Location in nginx container</b>: /etc/nginx/nginx.conf
        </p>
        <div
          className={
            nginxConfig.baseConfig.customValue ||
            nginxConfig.captainConfig.customValue
              ? ""
              : "hide-on-demand"
          }
        >
          <Input.TextArea
            className="code-input"
            placeholder=""
            rows={17}
            value={nginxConfig.baseConfig.customValue}
            onChange={e => {
              const newApiData = Utils.copyObject(nginxConfig);
              newApiData.baseConfig.customValue = e.target.value;
              self.setState({ nginxConfig: newApiData });
            }}
          />
          <div style={{ height: 40 }} />
        </div>
        <p>
          <b>CapRover Config Location in nginx container</b>:
          /etc/nginx/conf.d/captain-root.conf
        </p>
        <div
          className={
            nginxConfig.baseConfig.customValue ||
            nginxConfig.captainConfig.customValue
              ? ""
              : "hide-on-demand"
          }
        >
          <Input.TextArea
            className="code-input"
            placeholder=""
            rows={17}
            value={nginxConfig.captainConfig.customValue}
            onChange={e => {
              const newApiData = Utils.copyObject(nginxConfig);
              newApiData.captainConfig.customValue = e.target.value;
              self.setState({ nginxConfig: newApiData });
            }}
          />
        </div>
        <div style={{ height: 40 }} />
        <div>
          <Row type="flex" justify="end">
            <Button
              type="default"
              onClick={() => self.onLoadDefaultNginxConfigClicked()}
            >
              Load Default and Edit
            </Button>
          </Row>

          <div style={{ height: 20 }} />

          <Row type="flex" justify="end">
            <Button
              type="primary"
              onClick={() => self.onUpdateNginxConfigClicked()}
            >
              <span>
                <Icon type="sync" />
              </span>{" "}
              &nbsp; Save and Update
            </Button>
          </Row>
        </div>
      </div>
    );
  }
}
