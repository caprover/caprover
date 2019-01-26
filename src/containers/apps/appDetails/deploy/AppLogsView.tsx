import React, { Component } from "react";
import ApiComponent from "../../../global/ApiComponent";
import Toaster from "../../../../utils/Toaster";
import ClickableLink from "../../../global/ClickableLink";
import { Input, Icon, Alert, Row, Spin, Col, Tooltip } from "antd";
import Utils from "../../../../utils/Utils";

export default class AppLogsView extends ApiComponent<
  {
    appName: string;
  },
  {
    expandedLogs: boolean;
    appLogsStringified: string;
    isWrapped: boolean;
  }
> {
  private fetchLogsInterval: any;
  constructor(props: any) {
    super(props);
    this.state = {
      isWrapped: true,
      expandedLogs: true,
      appLogsStringified: ""
    };
  }

  componentWillUnmount() {
    if (super.componentWillUnmount) super.componentWillUnmount();
    if (this.fetchLogsInterval) {
      clearInterval(this.fetchLogsInterval);
    }
  }

  fetchLogs() {
    const self = this;
    const separators = [
      "\u0000\u0000\u0000\u0000",
      "\u0001\u0000\u0000\u0000",
      "\u0002\u0000\u0000\u0000"
    ];
    const ansiRegex = Utils.getAnsiColorRegex();
    this.apiManager
      .fetchAppLogs(this.props.appName)
      .then(function(logInfo: { logs: string }) {
        const logsProcessed = logInfo.logs
          .split(new RegExp(separators.join("|"), "g"))
          .map(s => {
            // See https://docs.docker.com/engine/api/v1.30/#operation/ContainerAttach for logs headers
            return s.substring(4, s.length).replace(ansiRegex, "");
            // add sorting if needed: new Date(s.substring(4+30, s.length)).getTime()
          })
          .join("");

        if (logsProcessed === self.state.appLogsStringified) {
          return;
        }

        const firstLogs = !self.state.appLogsStringified;

        let textareaNow = document.getElementById("applogs-text-id");
        // Almost at the bottom. So keep the scroll at the bottom. Otherwise, user, may have manually scrolled up. Respect the user!
        const shouldScrollToBottom =
          firstLogs ||
          (!!textareaNow &&
            Math.abs(
              textareaNow.scrollTop -
                (textareaNow.scrollHeight - textareaNow.offsetHeight)
            ) < 100);

        self.setState({ appLogsStringified: logsProcessed });

        if (shouldScrollToBottom)
          setTimeout(function() {
            let textarea = document.getElementById("applogs-text-id");
            if (textarea) textarea.scrollTop = textarea.scrollHeight;
          }, 100);
      })
      .catch(function(error) {
        self.setState({ appLogsStringified: "fetching app log failed..." });
      });
  }

  componentDidMount() {
    const self = this;
    this.fetchLogs();
    this.fetchLogsInterval = setInterval(function() {
      self.fetchLogs();
    }, 3300); // Just a random number to avoid hitting at the same time as build log fetch!
  }

  onExpandLogClicked() {
    this.setState({ expandedLogs: !this.state.expandedLogs });
  }

  render() {
    const self = this;
    return (
      <div>
        <div style={{ height: 20 }} />

        <div>
          <div>
            <Row type="flex" justify="space-between" align="middle">
              <span>
                <Row type="flex" justify="start" align="middle">
                  <span>
                    <ClickableLink
                      onLinkClicked={() => {
                        self.onExpandLogClicked();
                      }}
                    >
                      <h4 className="unselectable-span">
                        <Icon
                          type={
                            !this.state.expandedLogs
                              ? "down-circle"
                              : "up-circle"
                          }
                        />
                        &nbsp;&nbsp;
                        {!this.state.expandedLogs ? "View" : "Hide"} App Logs
                      </h4>
                    </ClickableLink>
                  </span>

                  <span style={{ marginLeft: 20, paddingBottom: 3 }}>
                    <Tooltip title="View full application logs (not truncated)">
                      <a
                        href="https://caprover.com/docs/troubleshooting.html#how-to-view-my-application-s-log"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon type="info-circle" />
                      </a>
                    </Tooltip>
                  </span>
                </Row>
              </span>
              <span className={this.state.expandedLogs ? "" : "hide-on-demand"}>
                <ClickableLink
                  onLinkClicked={() => {
                    self.setState({ isWrapped: !self.state.isWrapped });
                  }}
                >
                  <h4 className="unselectable-span">
                    <Icon type="menu-fold" />
                    &nbsp;&nbsp; {this.state.isWrapped ? "Don't" : ""} wrap logs
                    &nbsp;&nbsp;
                  </h4>
                </ClickableLink>
              </span>
            </Row>
          </div>

          <div
            className={this.state.expandedLogs ? "" : "hide-on-demand"}
            style={{ padding: 5 }}
          >
            <div
              id="applogs-text-id"
              className="logs-output"
              style={{
                whiteSpace: self.state.isWrapped ? "pre-line" : "pre"
              }}
            >
              {self.state.appLogsStringified}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
