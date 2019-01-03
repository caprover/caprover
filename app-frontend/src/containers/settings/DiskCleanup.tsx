import React, { Component } from "react";
import {
  Row,
  Col,
  Input,
  InputNumber,
  Tooltip,
  Button,
  Icon,
  message
} from "antd";
import ApiComponent from "../global/ApiComponent";
import Toaster from "../../utils/Toaster";
import CenteredSpinner from "../global/CenteredSpinner";
import UnusedImagesTable from "./UnusedImagesTable";
import ErrorRetry from "../global/ErrorRetry";

export interface IUnusedImage {
  tags: string[];
  id: string;
}

export default class DiskCleanup extends ApiComponent<
  {},
  {
    isLoading: boolean;
    mostRecentLimit: number;
    unusedImages?: IUnusedImage[];
    selectedImagesForDelete: string[];
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      isLoading: false,
      mostRecentLimit: 2,
      selectedImagesForDelete: [],
      unusedImages: []
    };
  }

  onRemoveImagesClicked() {
    const self = this;
    this.setState({ isLoading: true });
    this.apiManager
      .deleteImages(this.state.selectedImagesForDelete)
      .then(function() {
        message.success("Unused images are deleted.");
        self.refreshOldImagesList();
      })
      .catch(
        Toaster.createCatcher(function() {
          self.setState({ isLoading: false });
        })
      );
  }

  refreshOldImagesList() {
    const self = this;
    this.setState({ unusedImages: undefined, isLoading: true });
    return this.apiManager
      .getUnusedImages(this.state.mostRecentLimit)
      .then(function(data) {
        self.setState({ unusedImages: data.unusedImages });
      })
      .catch(Toaster.createCatcher())
      .then(function() {
        self.setState({ isLoading: false });
      });
  }

  render() {
    const self = this;

    if (self.state.isLoading) {
      return <CenteredSpinner />;
    }

    const unusedImages = this.state.unusedImages;

    if (!unusedImages) {
      return <ErrorRetry />;
    }

    const hasSelectedImagesForRemoval = !!(
      self.state.selectedImagesForDelete &&
      self.state.selectedImagesForDelete.length
    );

    return (
      <div>
        <div>
          <p>
            Every time you deploy a new build, Docker builds a new image for
            you. Typically, a large part of this image is shared between the old
            version and the new version, but a small chunk is added to your disk
            with each build. You can read more about disk cleanup in the docs,
            but as a simple interface, this widget gives you the ability to
            perform image cleanups on demand.
          </p>
          <p>
            You can perform this action, after each deploy. But it's typically
            not needed with that frequency. For typical mid-sized projects, it's
            recommended to perform this cleanup after every ~20 builds.
          </p>
          <p>
            With default parameter, it keeps the last two recent builds of all
            current apps, and creates a list of images that can be deleted (by
            clicking on Get List button). You can select which images you want
            to delete and click on Remove Images button. You might noticed that
            some images are not deleted even though you clicked on Remove
            Images, it means they are being directly or indirectly in-use by
            Docker. A common example For indirect usage is an image whose child
            image is being used by an alive container.
          </p>

          <br />
        </div>

        <Row>
          <Col span={12}>
            <Tooltip title="For example, enter 2 in order to exclude 2 most recent builds during clean-up">
              <Input
                addonBefore="Keep most recent"
                type="number"
                value={this.state.mostRecentLimit + ""}
                onChange={e => {
                  this.setState({ mostRecentLimit: Number(e.target.value) });
                }}
              />
            </Tooltip>
          </Col>
          <Col span={12}>
            <Row type="flex" justify="end">
              <Button
                type="default"
                onClick={() => this.refreshOldImagesList()}
              >
                <span>
                  <Icon type="sync" />
                </span>{" "}
                &nbsp; Get List
              </Button>
            </Row>
          </Col>
        </Row>

        <div className={unusedImages.length > 0 ? "" : "hide-on-demand"}>
          <div style={{ height: 20 }} />
          <Row type="flex" justify="end">
            <Tooltip
              title={
                hasSelectedImagesForRemoval
                  ? ""
                  : "Select images that you want to remove. You can select all from the top row."
              }
            >
              <Button
                disabled={!hasSelectedImagesForRemoval}
                type="primary"
                onClick={() => {
                  self.onRemoveImagesClicked();
                }}
              >
                <span>
                  <Icon type="delete" />{" "}
                </span>{" "}
                &nbsp; Remove Unused Images
              </Button>
            </Tooltip>
          </Row>
          <div style={{ height: 20 }} />
          <div>
            <b>NOTE: </b> Images that are being used (directly or indirectly)
            will not be deleted even if you select them.
          </div>
          <div style={{ height: 20 }} />
          <UnusedImagesTable
            unusedImages={unusedImages}
            updateModel={selectedImagesForDelete =>
              this.setState({ selectedImagesForDelete })
            }
          />
        </div>
      </div>
    );
  }
}
