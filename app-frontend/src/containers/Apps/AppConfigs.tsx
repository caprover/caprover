import React, { Component } from "react";
import {
  message,
  Row,
  Button,
  Input,
  Col,
  Icon,
  Tooltip,
  Checkbox
} from "antd";
import Toaster from "../../utils/Toaster";
import Utils from "../../utils/Utils";
import { AppDetailsTabProps } from "./AppDetails";

const Search = Input.Search;

export default class AppConfigs extends Component<
  AppDetailsTabProps,
  { dummyVar: undefined; forceEditableInstanceCount: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      dummyVar: undefined,
      forceEditableInstanceCount: false
    };
  }
  createEnvVarRows() {
    /*
    <div class="row" ng-repeat="ev in app.envVars">
  <div class="form-group col-sm-6">
    <div class="input-group">
      <span class="input-group-addon">Key:</span>
      <input style="height:50px" type="text" class="form-control" ng-model="ev.key" placeholder="Key">
    </div>
  </div>
  <div class="col-sm-6 form-group">
    <div class="input-group">
      <span class="input-group-addon">Value:</span>
      <textarea style="height:50px;padding-top:13px;" type="text" class="form-control" ng-model="ev.value" placeholder="Value"></textarea>
    </div>
  </div>
</div>
    */
    return <div>createEnvVarRows</div>;
  }

  createPortRows() {
    /*
                      <div class="row" ng-repeat="pt in app.ports">
                        <div class="form-group col-sm-6">
                          <div class="input-group" uib-tooltip="Make sure the port is not used!">
                            <span class="input-group-addon">Server Public Port:</span>
                            <input style="height:50px" type="text" class="form-control" ng-model="pt.hostPort" placeholder="4545">
                          </div>
                        </div>
                        <div class="col-sm-6 form-group">
                          <div class="input-group">
                            <span class="input-group-addon">Container Port:</span>
                            <textarea style="height:50px;padding-top:13px;" type="text" class="form-control" ng-model="pt.containerPort" placeholder="80"></textarea>
                          </div>
                        </div>
                      </div>


    */
    return <div>createVolRows</div>;
  }

  createVolSection() {
    const app = this.props.apiData!.appDefinition;

    if (!app.hasPersistentData) return <div />;

    return <div>has volumes</div>;

    /*
    <h4>Persistent Directories &nbsp;
                        <a href="https://captainduckduck.com/docs/app-configuration.html#persistent-or-not" target="_blank" rel="noopener noreferrer">
                          <i class="fa fa-info-circle" aria-hidden="true"></i>
                        </a>


                      </h4>
                      <div ng-show="!app.volumes || !app.volumes.length">
                        <i>Currently, this app does not have any persistent directories.</i>
                      </div>
                      <br/>
                      <div class="row" ng-repeat="vol in app.volumes">
                        <div class="form-group col-sm-4">
                          <div class="input-group">
                            <span class="input-group-addon">Path in App:</span>
                            <input type="text" class="form-control" ng-model="vol.containerPath" placeholder="/some/thing">
                          </div>
                        </div>
                        <div ng-show="!!vol.hostPath" class="form-group col-sm-4">
                          <div class="input-group" uib-tooltip="IMPORTANT: Ensure Host Path exists before assigning it here">
                            <span class="input-group-addon">Path on Host:</span>
                            <input type="text" class="form-control" ng-model="vol.hostPath" placeholder="/host/path/exists">
                          </div>
                        </div>
                        <div ng-show="!vol.hostPath" class="form-group col-sm-4">
                          <div class="input-group">
                            <span class="input-group-addon">Label:</span>
                            <input type="text" class="form-control" ng-model="vol.volumeName" placeholder="some-name">
                          </div>
                        </div>
                        <div class="form-group col-sm-4">
                          <button ng-show="!vol.hostPath" type="button" class="btn btn-sm btn-default" ng-click="setHostPath(vol,'/')">Set specific host path</button>
                          <button ng-show="vol.hostPath" type="button" class="btn btn-sm btn-default" ng-click="setHostPath(vol,'')">Let Captain manage host path</button>
                        </div>
                      </div>
                      <div class="row">
                        <div class="col-md-12">
                          <button type="button" ng-click="addVolumeClicked()" class="btn btn-default">Add Directory</button>
                        </div>
                      </div>

                      <hr/>

                      <div class="row">
                        <div class="form-group col-md-6">
                          <div class="input-group">
                            <span class="input-group-addon">

                              <a href="" uib-tooltip="Click to edit" ng-click="unlockNodeId()">
                                Node ID &nbsp;
                                <i class="fa fa-pencil" aria-hidden="true"></i>
                              </a>

                            </span>
                            <input uib-tooltip="Leave empty for automatic placement" type="text" class="form-control" ng-disabled="!app.unlockNodeIdForEdit"
                              ng-model="app.nodeId">
                          </div>
                          <div class="input-group">
                          </div>
                        </div>
                        <div class="col-md-6">
                          <p>
                            <b>WARNING: </b>Changing Node ID causes the content of your persistent directories to be deleted!
                          </p>
                        </div>
                      </div>
    */
  }

  render() {
    const app = this.props.apiData!.appDefinition;
    return (
      <div>
        <h4>Environmental Variables:</h4>
        <div
          className={
            app.envVars && !!app.envVars.length ? "hide-on-demand" : ""
          }
        >
          <i>
            Currently, this app does not have any custom environmental variables
            yet.
          </i>
        </div>
        <br />

        {this.createEnvVarRows()}

        <br />

        <Button type="default" onClick={() => this.addEnvVarClicked()}>
          Add Key/Value Pair
        </Button>

        <br />
        <br />
        <br />

        <h4>
          Port Mapping &nbsp;
          <a
            href="https://captainduckduck.com/docs/app-configuration.html#port-mapping"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon type="info-circle" />
          </a>
        </h4>
        <div
          className={app.ports && !!app.ports.length ? "hide-on-demand" : ""}
        >
          <i>Currently, this app does not have any custom port mapping.</i>
        </div>
        <br />

        <Button type="default" onClick={() => this.addPortMappingClicked()}>
          Add Port Mapping
        </Button>
        <br />
        <br />
        <br />
        {this.createVolSection()}
        <Row>
          <Col span={6} style={{ width: 200 }}>
            <Tooltip title="Number of running instances of this app">
              <Input
                addonBefore="Instance Count"
                type="number"
                defaultValue={app.instanceCount + ""}
                disabled={
                  app.hasPersistentData &&
                  !this.state.forceEditableInstanceCount
                }
              />
            </Tooltip>
          </Col>
          <Col span={6}>
            <div className={!app.hasPersistentData ? "hide-on-demand" : ""}>
              <Tooltip title="Multiple instances of apps with persistent data can be very dangerous and bug prone as they can be accessing the same file on the disk resulting in data corruption. Edit the instance count only if you understand the risk.">
                <Button
                  type="default"
                  disabled={this.state.forceEditableInstanceCount}
                  onClick={() =>
                    this.setState({ forceEditableInstanceCount: true })
                  }
                >
                  Edit
                </Button>
              </Tooltip>
            </div>
          </Col>
        </Row>
        
        {/* <div class="row">
        <div class="col-lg-12">
          <div class="row">
            <a href="" ng-click="onPreDeployFunctionToggled()">
              <h5>{{!!app.hasPreDeployFunction? 'Remove':'Add'}} Pre-Deploy Script
                &nbsp;
                <a href="https://captainduckduck.com/docs/pre-deploy-script.html" target="_blank" rel="noopener noreferrer">
                  &nbsp; <i class="fa fa-info-circle" aria-hidden="true"></i>
                </a>

              </h5>
            </a>
          </div>

          <div class="row" ng-show="!!app.hasPreDeployFunction">
                <textarea id="post-deploy-text-id" style="padding:10px; background: #f9f9f9" rows="10"
                          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                          ng-model = "app.preDeployFunction"
                          class="col-sm-12"></textarea>
          </div>

        </div>
      </div>

      </div> */}
      </div>
    );
  }

  addPortMappingClicked() {}

  addEnvVarClicked() {}

  reFetchData() {
    this.props.reFetchData();
  }
}
