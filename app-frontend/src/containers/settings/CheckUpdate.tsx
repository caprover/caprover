import React, { Component } from "react";
import { Icon, Button, message, Modal, Row, Alert } from "antd";
import ApiComponent from "../global/ApiComponent";
import CenteredSpinner from "../global/CenteredSpinner";
import Toaster from "../../utils/Toaster";

export default class CheckUpdate extends ApiComponent<
  {},
  { versionInfo: any; timeToRefresh: number }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      versionInfo: undefined,
      timeToRefresh: 0
    };
  }

  componentDidMount() {
    const self = this;
    self.apiManager
      .getVersionInfo()
      .then(function(data) {
        self.setState({ versionInfo: data });
      })
      .catch(Toaster.createCatcher());
  }

  startCounter() {
    const self = this;
    this.setState({ timeToRefresh: 30 });
    setInterval(function() {
      if (self.state.timeToRefresh < 2) {
        window.location.reload(true);
        return;
      }
      self.setState({ timeToRefresh: self.state.timeToRefresh - 1 });
    }, 1000);
  }

  onPerformUpdateClicked() {
    const self = this;
    const versionInfo = this.state.versionInfo;
    self.apiManager
      .performUpdate(versionInfo.latestVersion)
      .then(function(data) {
        self.startCounter();
      })
      .catch(Toaster.createCatcher());
  }

  render() {
    const self = this;
    const versionInfo = this.state.versionInfo;

    if (!versionInfo) {
      return <CenteredSpinner />;
    }

    return (
      <div>
        <p>
          Captain allows in-place updates to be installed. However, always read
          the change logs before updating your Captain. There might be breaking
          changes that you need to be aware of. The update usually takes around
          60 seconds and your Captain may become unresponsive until the update
          process is finished. Your apps will stay functional and responsive
          during this time, except for a very short period of 10 seconds or
          less.
        </p>
        <br />
        <p>
          <b>Current Version</b>: {versionInfo.currentVersion}
        </p>
        <p>
          <b>Latest Stable Version</b>: {versionInfo.latestVersion}
        </p>
        <div className={versionInfo.canUpdate ? "" : "hide-on-demand"}>
          <Row type="flex" justify="end">
            <Button
              type="primary"
              onClick={() => this.onPerformUpdateClicked()}
            >
              <span>
                <Icon type="cloud-download" />
              </span>{" "}
              &nbsp; Install Update
            </Button>
          </Row>
        </div>

        <div className={!versionInfo.canUpdate ? "" : "hide-on-demand"}>
          <Alert message="Your Captain is the latest version." type="info" />
        </div>

        <Modal
          closable={false}
          footer={<div />}
          title="Update Process Started"
          visible={self.state.timeToRefresh > 0}
        >
          <div>
            <p>
              Update takes around 30 to 60 seconds to complete depending on your
              server connection speed.
            </p>
            <p>
              Your Captain dashboard is not functional during the update. Please
              wait until this page is refreshed automatically.
            </p>

            <p>
              <b>Time to Refresh: </b>
              {this.state.timeToRefresh}
            </p>
          </div>
        </Modal>
      </div>
    );
  }
}
