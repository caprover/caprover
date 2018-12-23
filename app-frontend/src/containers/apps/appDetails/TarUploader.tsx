import React, { Component } from "react";
import ApiComponent from "../../global/ApiComponent";
import { Upload, Col, Row, Icon, message, Button } from "antd";
import { UploadFile, UploadChangeParam } from "antd/lib/upload/interface";
import Toaster from "../../../utils/Toaster";

export default class TarUploader extends ApiComponent<
  {
    appName: string;
    onUploadSucceeded: () => void;
  },
  {
    fileToBeUploaded: UploadFile | undefined;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      fileToBeUploaded: undefined
    };
  }

  beforeUpload = (file: File) => {
    // We handle upload manually :)
    return false;
  };

  handleChange = (info: UploadChangeParam) => {
    if (info.fileList.length > 1) {
      message.error(
        "You can only upload one TAR file! Remove the currently selected file first."
      );
      return;
    }

    if (info.fileList.length === 0) {
      this.setState({ fileToBeUploaded: undefined });
      message.info("File removed");
      return;
    }

    let file = info.fileList[0];

    if (file.name.indexOf(".tar") < 0) {
      message.error("You can only upload a TAR file!");
      return;
    }

    this.setState({ fileToBeUploaded: file });
  };

  startUploadAndDeploy() {
    const self = this;

    Promise.resolve()
      .then(function() {
        return self.apiManager.uploadAppData(
          self.props.appName,
          self.state.fileToBeUploaded!.originFileObj!
        );
      })
      .then(function() {
        self.props.onUploadSucceeded();
      })
      .catch(Toaster.createCatcher());
  }

  render() {
    return (
      <div>
        <Row type="flex" justify="center">
          <Col span={12}>
            <Upload.Dragger
              name="files"
              accept="*/*"
              multiple={false}
              fileList={
                this.state.fileToBeUploaded
                  ? [this.state.fileToBeUploaded]
                  : undefined
              }
              listType="text"
              onChange={this.handleChange}
              beforeUpload={this.beforeUpload}
              action="//" // this is unused as beforeUpload always returns false
            >
              <p className="ant-upload-drag-icon">
                <Icon type="inbox" />
              </p>
              <p className="ant-upload-text">
                Click or drag TAR file to this area to upload
              </p>
              <p className="ant-upload-hint">
                Must contain <code>captain-definition</code> file.
              </p>
            </Upload.Dragger>
          </Col>
        </Row>

        <Row type="flex" justify="center">
          <Button
            style={{ marginTop: 40 }}
            disabled={!this.state.fileToBeUploaded}
            onClick={() => this.startUploadAndDeploy()}
            type="primary"
            size="large"
          >
            Upload &amp; Deploy
          </Button>
        </Row>
      </div>
    );
  }
}
