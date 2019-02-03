import React, { Component } from "react";
import OneClickAppsApi from "../../../api/OneClickAppsApi";
import { RouteComponentProps } from "react-router";
import { IHashMapGeneric } from "../../../models/IHashMapGeneric";
import Toaster from "../../../utils/Toaster";
import { Row, Col, Card, message } from "antd";
import CenteredSpinner from "../../global/CenteredSpinner";
import OneClickVariablesSection from "./OneClickVariablesSection";
import OneClickAppDeployManager, {
  IDeploymentState
} from "./OneClickAppDeployManager";
import OneClickAppDeployProgress from "./OneClickAppDeployProgress";
import DomUtils from "../../../utils/DomUtils";
import { IOneClickTemplate } from "../../../models/IOneClickAppModels";
import { TEMPLATE_ONE_CLICK_APP } from "./OneClickAppSelector";
const queryString = require("query-string");

export const ONE_CLICK_APP_NAME_VAR_NAME = "$$cap_appname";

export default class OneClickAppConfigPage extends Component<
  RouteComponentProps<any>,
  {
    apiData: IOneClickTemplate | undefined;
    deploymentState: IDeploymentState | undefined;
  }
> {
  private oneClickAppDeployHelper: OneClickAppDeployManager;
  private isUnmount: boolean = false;

  constructor(props: any) {
    super(props);
    const self = this;
    this.state = {
      apiData: undefined,
      deploymentState: undefined
    };
    this.oneClickAppDeployHelper = new OneClickAppDeployManager(
      deploymentState => {
        if (self.isUnmount) {
          return;
        }
        self.setState({ deploymentState });
      }
    );
  }

  componentWillUnmount() {
    if (super.componentWillUnmount) super.componentWillUnmount();
    this.isUnmount = true;
  }

  componentDidMount() {
    const self = this;

    const appNameFromPath = this.props.match.params.appName;
    let promiseToFetchOneClick =
      appNameFromPath === TEMPLATE_ONE_CLICK_APP
        ? new Promise(function(resolve, reject) {
            resolve(
              JSON.parse(
                queryString.parse(self.props.location.search, {
                  ignoreQueryPrefix: true
                }).oneClickAppStringifiedData
              )
            );
          })
        : new OneClickAppsApi().getOneClickAppByName(appNameFromPath);

    promiseToFetchOneClick
      .then(function(data: IOneClickTemplate) {
        if ((data.captainVersion || "").toString() !== "1") {
          message.error(
            "One-Click App version does not match! Create a GitHub issue please!"
          );
          return;
        }

        data.variables = data.variables || [];
        // Adding app name to all one click apps
        data.variables.unshift({
          id: ONE_CLICK_APP_NAME_VAR_NAME,
          label: "App Name",
          description:
            "This is your app name. Pick a name such as my-first-1-click-app",
          validRegex: "/^([a-z0-9]+\\-)*[a-z0-9]+$/" // string version of /^([a-z0-9]+\-)*[a-z0-9]+$/
        });
        self.setState({ apiData: data });
      })
      .catch(Toaster.createCatcher());
  }

  render() {
    const self = this;
    const deploymentState = this.state.deploymentState;
    const apiData = this.state.apiData;

    if (!apiData) {
      return <CenteredSpinner />;
    }

    if (!!deploymentState) {
      return (
        <OneClickAppDeployProgress
          appName={self.props.match.params.appName}
          deploymentState={deploymentState}
          onFinishClicked={() => self.props.history.push("/apps")}
          onRestartClicked={() => self.setState({ deploymentState: undefined })}
        />
      );
    }

    return (
      <div>
        <Row type="flex" justify="center">
          <Col span={16}>
            <Card title={`Setup your ${this.props.match.params.appName}`}>
              <h2>{this.props.match.params.appName}</h2>
              <p
                style={{
                  whiteSpace: "pre-line",
                  paddingLeft: 15,
                  paddingRight: 15
                }}
              >
                {apiData.instructions.start}
              </p>
              <div style={{ height: 40 }} />
              <OneClickVariablesSection
                oneClickAppVariables={apiData.variables}
                onNextClicked={values => {
                  self.oneClickAppDeployHelper.startDeployProcess(
                    self.state.apiData!,
                    values
                  );
                  DomUtils.scrollToTopBar();
                }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }
}
