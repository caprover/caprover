import React, { Component } from "react";
import { AppDetailsTabProps } from "./AppDetails";
import BuildLogsView from "./BuildLogsView";
import { Col, Row, Upload, Input, message, Icon } from "antd";
import TarUploader from "./TarUploader";
import GitRepoForm from "./GitRepoForm";
import { RepoInfo } from "../AppDefinition";
import Utils from "../../../utils/Utils";

export default class Deployment extends Component<
  AppDetailsTabProps,
  {
    dummyVar: undefined;
    //
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      dummyVar: undefined
    };
  }
  render() {
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
        <BuildLogsView appName={app.appName!} />
        <div style={{ height: 20 }} />
        <hr />
        <div style={{ height: 20 }} />
        <div>
          <p>
            <b>Current Version: </b>
            {app.deployedVersion}
            <br />
            <b>Git Commit Hash: </b>{" "}
            {app.versions[app.deployedVersion].gitHash || "n/a"}
            <br />
            <b>Deployed at</b>{" "}
            {new Date(
              app.versions[app.deployedVersion].timeStamp
            ).toLocaleString()}
            <br />
          </p>
        </div>

        <p>
          Make sure that you have a 'captain-definition' file in your project.
          See{" "}
          <a
            href="https://captainduckduck.com/docs/captain-definition-file.html"
            target="_blank"
          >
            docs
          </a>{" "}
          for more details.
        </p>
        <div style={{ height: 20 }} />
        <h4>
          <Icon type="code" /> Method 1: Official CLI
        </h4>
        <p>
          Use CLI deploy command. This is the easiest method as it only requires
          a simply command like <code>captainduckduck deploy</code>. Read more
          about it in the{" "}
          <a
            href="https://captainduckduck.com/docs/get-started.html#step-4-deploy-the-test-app"
            target="_blank"
          >
            docs
          </a>
        </p>
        <div style={{ height: 20 }} />
        <h4>
          <Icon type="code" /> Method 2: Tarball
        </h4>
        <p>
          You can simply create a tarball (<code>.tar</code>) of your project
          and upload it here via upload button.
        </p>

        <TarUploader appName={app.appName!} />

        <div style={{ height: 40 }} />
        <h4>
          <Icon type="code" /> Method 3: Deploy from Github/Bitbucket/Gitlab
        </h4>
        <p>
          Enter your repository information in the form and save. Then copy the
          URL in the box as a webhook on Github, Bitbucket, Gitlab and etc. Once
          you push a commit, CaptainDuckDuck starts a new build.
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
                  "/api/v1/user/webhooks/triggerbuild?namespace=captain&token=" +
                  app.appPushWebhook!.pushWebhookToken
                : "** Add repo info and save for this webhook to appear **"
            }
          />
        </Row>
        <br />
        <GitRepoForm
          gitRepoValues={repoInfo}
          updateRepoInfo={newRepo => {
            console.log(newRepo);
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
        <div style={{ height: 20 }} />
        <h4>
          <Icon type="code" /> Method 4: Deploy plain Dockerfile
        </h4>
        <div style={{ height: 20 }} />
        <h4>
          <Icon type="code" /> Method 5: Deploy solo captain-definition file
        </h4>
      </div>
    );
  }
}
