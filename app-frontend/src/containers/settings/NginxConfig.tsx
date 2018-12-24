import React, { Component } from "react";
import ApiComponent from "../global/ApiComponent";
import { Input, Icon, Row, Button, message, Modal } from "antd";
import Utils from "../../utils/Utils";
import CenteredSpinner from "../global/CenteredSpinner";
import Toaster from "../../utils/Toaster";

export default class NginxConfig extends ApiComponent<
  {},
  { nginxConfig: any }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      nginxConfig: undefined
    };
  }

  componentDidMount() {
    const self = this;
    this.apiManager
      .getNginxConfig()
      .then(function(data) {
        self.setState({ nginxConfig: data });
      })
      .catch(Toaster.createCatcher());
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
    this.apiManager
      .setNginxConfig(
        newApiData.baseConfig.customValue,
        newApiData.captainConfig.customValue
      )
      .then(function(data) {
        setTimeout(function() {
          window.location.reload(true);
        }, 6000);

        Modal.success({
          title: "Config Changed",
          content: (
            <div>
              Nginx is successfully updated, Captain will restart in 10 seconds.{" "}
              <b>Please wait until the page is automatically refreshed.</b>
            </div>
          ),
          onOk() {},
          onCancel() {}
        });
      })
      .catch(Toaster.createCatcher());
  }

  render() {
    const self = this;
    const nginxConfig = this.state.nginxConfig;

    if (!nginxConfig) {
      return <CenteredSpinner />;
    }

    return (
      <div>
        {" "}
        <p>
          Captain allows you to set custom configurations for your nginx router.
          This will allow high customization level in terms of caching, special
          routing, http2 and etc.
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
          <b>Captain Config Location in nginx container</b>:
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
