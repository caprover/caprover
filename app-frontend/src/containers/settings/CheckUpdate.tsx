import React, { Component } from "react";
import { Icon, Button, message, Modal, Row, Alert } from "antd";
import ApiComponent from "../global/ApiComponent";
import CenteredSpinner from "../global/CenteredSpinner";
import Toaster from "../../utils/Toaster";
import ReloadCaptainModal from "./ReloadCaptainModal";
import { IVersionInfo } from "../../models/IVersionInfo";

export default class CheckUpdate extends ApiComponent<
  {},
  { versionInfo: IVersionInfo | undefined; isRefreshTimerActivated: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      versionInfo: undefined,
      isRefreshTimerActivated: false
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

  onPerformUpdateClicked() {
    const self = this;
    const versionInfo = this.state.versionInfo;
    self.apiManager
      .performUpdate(versionInfo!.latestVersion)
      .then(function(data) {
        self.setState({ isRefreshTimerActivated: true });
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

        <ReloadCaptainModal
          isRefreshTimerActivated={self.state.isRefreshTimerActivated}
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

            <br />
            <br />
          </div>
        </ReloadCaptainModal>
      </div>
    );
  }
}
