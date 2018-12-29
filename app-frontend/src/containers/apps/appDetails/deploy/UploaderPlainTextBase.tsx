import React, { Component } from "react";
import ApiComponent from "../../../global/ApiComponent";
import { Row, Input, Button } from "antd";
import Toaster from "../../../../utils/Toaster";

export default abstract class UploaderPlainTextBase extends ApiComponent<
  {
    appName: string;
    onUploadSucceeded: () => void;
  },
  {
    userEnteredValue: string;
    uploadInProcess: boolean;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      userEnteredValue: "",
      uploadInProcess: false
    };
  }

  protected abstract getPlaceHolderValue(): string;

  protected abstract convertDataToCaptainDefinition(
    userEnteredValue: string
  ): string;

  startDeploy(captainDefinitionToBeUploaded: string) {
    const self = this;

    Promise.resolve() //
      .then(function() {
        self.setState({ uploadInProcess: true });
        return self.apiManager.uploadCaptainDefinitionContent(
          self.props.appName,
          JSON.parse(captainDefinitionToBeUploaded),
          true
        );
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.setState({ uploadInProcess: false });
      });
  }

  render() {
    const self = this;
    return (
      <div style={{ padding: 16 }}>
        <Row>
          <Input.TextArea
            className="code-input"
            placeholder={self.getPlaceHolderValue()}
            rows={7}
            value={self.state.userEnteredValue}
            onChange={e => {
              self.setState({
                userEnteredValue: e.target.value
              });
            }}
          />
        </Row>
        <div style={{ height: 20 }} />
        <Row type="flex" justify="end">
          <Button
            disabled={!self.state.userEnteredValue.trim()}
            type="primary"
            onClick={() =>
              self.startDeploy(
                self.convertDataToCaptainDefinition(self.state.userEnteredValue)
              )
            }
          >
            Deploy Now
          </Button>
        </Row>
      </div>
    );
  }
}
