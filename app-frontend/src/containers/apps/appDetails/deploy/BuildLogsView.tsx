import React, { Component } from "react";
import ApiComponent from "../../../global/ApiComponent";
import Toaster from "../../../../utils/Toaster";
import ClickableLink from "../../../global/ClickableLink";
import { Input, Icon, Alert, Row, Spin } from "antd";
import Utils from "../../../../utils/Utils";

export default class BuildLogsView extends ApiComponent<
  {
    appName: string;
    buildLogRecreationId: string;
  },
  {
    isAppBuilding: boolean;
    expandedLogs: boolean;
    buildLogs: string;
    lastLineNumberPrinted: number;
  }
> {
  private fetchBuildLogsInterval: any;
  constructor(props: any) {
    super(props);
    this.state = {
      isAppBuilding: false,
      expandedLogs: !!this.props.buildLogRecreationId,
      buildLogs: "",
      lastLineNumberPrinted: -10000
    };
  }

  componentWillUnmount() {
    if (this.fetchBuildLogsInterval) {
      clearInterval(this.fetchBuildLogsInterval);
    }
  }

  fetchBuildLogs() {
    const self = this;
    this.apiManager
      .fetchBuildLogs(this.props.appName)
      .then(function(logInfo) {
        self.setState({ isAppBuilding: logInfo.isAppBuilding });
        if (logInfo.isAppBuilding) {
          // forcefully expanding the view such that when building finishes it doesn't collapses automatically
          self.setState({ expandedLogs: true });
        }

        let lines = logInfo.logs.lines as string[];
        let firstLineNumberOfLogs = logInfo.logs.firstLineNumber;
        let firstLinesToPrint = 0;
        if (firstLineNumberOfLogs > self.state.lastLineNumberPrinted) {
          if (firstLineNumberOfLogs < 0) {
            // This is the very first fetch, probably firstLineNumberOfLogs is around -50
            firstLinesToPrint = -firstLineNumberOfLogs;
          } else {
            self.setState({
              buildLogs: self.state.buildLogs + "[[ TRUNCATED ]]\n"
            });
          }
        } else {
          firstLinesToPrint =
            self.state.lastLineNumberPrinted - firstLineNumberOfLogs;
        }

        self.setState({
          lastLineNumberPrinted: firstLineNumberOfLogs + lines.length
        });

        let lineAdded = false;

        let buildLogs = self.state.buildLogs;
        const ansiRegex = Utils.getAnsiColorRegex();
        for (let i = firstLinesToPrint; i < lines.length; i++) {
          const newLine = (lines[i] || "").trim().replace(ansiRegex, "");
          buildLogs += newLine + "\n";

          lineAdded = true;
        }
        self.setState({ buildLogs: buildLogs });

        if (lineAdded) {
          setTimeout(function() {
            let textarea = document.getElementById("buildlog-text-id");
            if (textarea) textarea.scrollTop = textarea.scrollHeight;
          }, 100);
        }
      })
      .catch(Toaster.createCatcher());
  }

  componentDidMount() {
    const self = this;
    this.fetchBuildLogs();
    this.fetchBuildLogsInterval = setInterval(function() {
      self.fetchBuildLogs();
    }, 2000);
  }

  onExpandLogClicked() {
    this.setState({ expandedLogs: !this.state.expandedLogs });
  }

  render() {
    const self = this;
    return (
      <div>
        <Row>
          <div className={this.state.isAppBuilding ? "" : "hide-on-demand"}>
            <Alert
              message={
                <span>
                  &nbsp;&nbsp;
                  <Spin
                    indicator={
                      <Icon type="loading" style={{ fontSize: 24 }} spin />
                    }
                    size="default"
                  />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Building the image. This
                  might take a few minutes...
                </span>
              }
              type="info"
            />
          </div>
        </Row>

        <div style={{ height: 20 }} />

        <div>
          <div>
            <ClickableLink
              onLinkClicked={() => {
                self.onExpandLogClicked();
              }}
            >
              <h4 className="unselectable-span">
                <Icon
                  type={!this.state.expandedLogs ? "down-circle" : "up-circle"}
                />
                &nbsp;&nbsp;
                {!this.state.expandedLogs ? "View" : "Hide"} Build Logs
              </h4>
            </ClickableLink>
          </div>

          <div
            className={
              this.state.isAppBuilding || this.state.expandedLogs
                ? ""
                : "hide-on-demand"
            }
            style={{ padding: 5 }}
          >
            <div
              id="buildlog-text-id"
              style={{
                overflow: "scroll",
                height: 250,
                border: "2px solid #cccccc",
                backgroundColor: "#f6f6f6",
                borderRadius: 5,
                padding: 10,
                fontSize: "90%"
              }}
            >
              <pre>{self.state.buildLogs}</pre>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
