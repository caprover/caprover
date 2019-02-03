import React, { Component } from "react";
import { AppDetailsTabProps } from "../AppDetails";
import BuildLogsView from "./BuildLogsView";
import { Col, Row, Upload, Input, message, Icon, Button, Tooltip } from "antd";
import TarUploader from "./TarUploader";
import GitRepoForm from "./GitRepoForm";
import { RepoInfo, IAppDef, IAppVersion } from "../../AppDefinition";
import Utils from "../../../../utils/Utils";
import DomUtils from "../../../../utils/DomUtils";
import UploaderPlainTextCaptainDefinition from "./UploaderPlainTextCaptainDefinition";
import UploaderPlainTextDockerfile from "./UploaderPlainTextDockerfile";
import ApiComponent from "../../../global/ApiComponent";
import AppVersionTable from "./AppVersionTable";
import Toaster from "../../../../utils/Toaster";
import AppLogsView from "./AppLogsView";

interface IDeploymentTabProps extends AppDetailsTabProps {
  onUpdateConfigAndSave: () => void;
}
export default class Deployment extends ApiComponent<
  IDeploymentTabProps,
  {
    dummyVar: undefined;
    forceEditableCaptainDefinitionPath: boolean;
    buildLogRecreationId: string;
    updatedVersions:
      | { versions: IAppVersion[]; deployedVersion: number }
      | undefined;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      dummyVar: undefined,
      forceEditableCaptainDefinitionPath: false,
      updatedVersions: undefined,
      buildLogRecreationId: ""
    };
  }

  onUploadSuccess() {
    message.info("Build has started");
    this.setState({ buildLogRecreationId: "" + new Date().getTime() });
    DomUtils.scrollToTopBar();
  }

  onAppBuildFinished() {
    const self = this;
    self.apiManager
      .getAllApps()
      .then(function(data) {
        const appDefs = data.appDefinitions as IAppDef[];
        for (let index = 0; index < appDefs.length; index++) {
          const element = appDefs[index];
          if (element.appName === self.props.apiData.appDefinition.appName) {
            return Utils.copyObject(element);
          }
        }
        throw new Error("App not found!");
      })
      .then(function(app) {
        self.setState({
          updatedVersions: {
            deployedVersion: app.deployedVersion,
            versions: app.versions
          }
        });
      })
      .catch(Toaster.createCatcher());
  }

  onVersionRollbackRequested(version: IAppVersion) {
    const self = this;
    self.apiManager
      .uploadCaptainDefinitionContent(
        self.props.apiData.appDefinition.appName!,
        {
          schemaVersion: 2,
          // We should use imageName, but since imageName does not report build failure (since there is no build!)
          // If we use that, and the image is not available, the service will not work.
          dockerfileLines: ["FROM " + version.deployedImageName]
        },
        version.gitHash || "",
        true
      )
      .then(function() {
        self.onUploadSuccess();
      })
      .catch(Toaster.createCatcher());
  }

  render() {
    const self = this;
    const app = this.props.apiData.appDefinition;
    const hasPushToken =
      app.appPushWebhook && app.appPushWebhook.pushWebhookToken;
    const repoInfo = app.appPushWebhook
      ? app.appPushWebhook.repoInfo
      : {
          user: "",
          password: "",
          branch: "",
          repo: ""
        };
    return (
      <div>
        <BuildLogsView
          onAppBuildFinished={() => self.onAppBuildFinished()}
          appName={app.appName!}
          buildLogRecreationId={self.state.buildLogRecreationId}
          key={app.appName! + "-" + self.state.buildLogRecreationId}
        />
        <div style={{ height: 20 }} />
        <hr />
        <div style={{ height: 20 }} />

        <AppVersionTable
          onVersionRollbackRequested={versionToRevert =>
            self.onVersionRollbackRequested(versionToRevert)
          }
          versions={
            self.state.updatedVersions
              ? self.state.updatedVersions.versions
              : app.versions
          }
          deployedVersion={
            self.state.updatedVersions
              ? self.state.updatedVersions.deployedVersion
              : app.deployedVersion
          }
        />

        <div style={{ height: 20 }} />
        <AppLogsView appName={app.appName!} key={app.appName! + "-LogsView"} />

        <hr />
        <div style={{ height: 40 }} />
        <h4>
          <Icon type="rocket" /> Method 1: Official CLI
        </h4>
        <p>
          Use CLI deploy command. This is the easiest method as it only requires
          a simply command like <code>caprover deploy</code>. Read more about it
          in the{" "}
          <a
            href="https://caprover.com/docs/get-started.html#step-4-deploy-the-test-app"
            target="_blank"
          >
            docs
          </a>
        </p>
        <div style={{ height: 20 }} />
        <h4>
          <Icon type="rocket" /> Method 2: Tarball
        </h4>
        <p>
          You can simply create a tarball (<code>.tar</code>) of your project
          and upload it here via upload button.
        </p>

        <TarUploader
          onUploadSucceeded={() => self.onUploadSuccess()}
          appName={app.appName!}
        />

        <div style={{ height: 40 }} />
        <h4>
          <Icon type="rocket" /> Method 3: Deploy from Github/Bitbucket/Gitlab
        </h4>
        <p>
          Enter your repository information in the form and save. Then copy the
          URL in the box as a webhook on Github, Bitbucket, Gitlab and etc. Once
          you push a commit, CapRover starts a new build.
          <br />
        </p>
        <Row>
          <Input
            onFocus={e => {
              if (hasPushToken) {
                e.target.select();
                document.execCommand("copy");
                message.info("Copied to clipboard!");
              }
            }}
            className="code-input"
            readOnly={true}
            disabled={!hasPushToken}
            defaultValue={
              hasPushToken
                ? window.location.protocol +
                  "//captain." +
                  this.props.apiData.rootDomain +
                  "/api/v2/user/apps/webhooks/triggerbuild?namespace=captain&token=" +
                  app.appPushWebhook!.pushWebhookToken
                : "** Add repo info and save for this webhook to appear **"
            }
          />
        </Row>
        <br />
        <GitRepoForm
          gitRepoValues={repoInfo}
          updateRepoInfo={newRepo => {
            const newApiData = Utils.copyObject(this.props.apiData);
            if (newApiData.appDefinition.appPushWebhook) {
              newApiData.appDefinition.appPushWebhook.repoInfo = Utils.copyObject(
                newRepo
              );
            } else {
              newApiData.appDefinition.appPushWebhook = {
                repoInfo: Utils.copyObject(newRepo)
              };
            }
            this.props.updateApiData(newApiData);
          }}
        />
        <Row type="flex" justify="end">
          <Button
            disabled={!repoInfo.repo}
            type="primary"
            onClick={() => self.props.onUpdateConfigAndSave()}
          >
            Save &amp; Update
          </Button>
        </Row>
        <div style={{ height: 20 }} />
        <h4>
          <Icon type="rocket" /> Method 4: Deploy plain Dockerfile
        </h4>
        <UploaderPlainTextDockerfile
          appName={app.appName!}
          onUploadSucceeded={() => self.onUploadSuccess()}
        />
        <div style={{ height: 20 }} />
        <h4>
          <Icon type="rocket" /> Method 5: Deploy captain-definition file
        </h4>
        <UploaderPlainTextCaptainDefinition
          appName={app.appName!}
          onUploadSucceeded={() => self.onUploadSuccess()}
        />
        <div style={{ height: 20 }} />
        <Row>
          <Col span={6} style={{ width: 400 }}>
            <Input
              addonBefore="captain-definition Relative Path"
              type="text"
              defaultValue={app.captainDefinitionRelativeFilePath + ""}
              disabled={!this.state.forceEditableCaptainDefinitionPath}
              onChange={e => {
                const newApiData = Utils.copyObject(this.props.apiData);
                newApiData.appDefinition.captainDefinitionRelativeFilePath =
                  e.target.value;
                this.props.updateApiData(newApiData);
              }}
            />
          </Col>
          <Col span={6}>
            <div
              style={{ paddingLeft: 24 }}
            >
              <Tooltip title="You shouldn't need to change this path unless you have a repository with multiple captain-definition files (mono repos). Read docs for captain definition before editing this">
                <Button
                  type="default"
                  disabled={this.state.forceEditableCaptainDefinitionPath}
                  onClick={() =>
                    this.setState({ forceEditableCaptainDefinitionPath: true })
                  }
                >
                  Edit
                </Button>
              </Tooltip>
            </div>
          </Col>
        </Row>
      </div>
    );
  }
}
