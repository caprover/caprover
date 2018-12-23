import React, { Component } from "react";
import ApiComponent from "../../global/ApiComponent";

export default class BuildLogsView extends ApiComponent<{
  appName: string;
}> {
  render() {
    return <div>BuildLogsView</div>;
    /*
    <div class="row alerts-container" ng-show="app.isAppBuilding">
        <uib-alert type="info">
          <div style="padding-left: 20px; padding-top: 10px;" class="row">
            <div class="pull-left">
              <div class="inline-loader"></div>
            </div>
            <div style="margin-left: 15px;" class="pull-left">
              Building the image. This might take a few minutes...
            </div>
          </div>
        </uib-alert>
      </div>
      <div class="row">
        <div class="row">
          <a href="" ng-click="onExpandLogClicked()">
            <h4>{{!app.expandedLogs? 'View':'Hide'}} Build Logs</h4>
          </a>
        </div>

        <div class="row" ng-show="app.isAppBuilding || app.expandedLogs">
          <textarea id="buildlog-text-id" style="padding:10px; background: #eeeeee" rows="10" readonly class="col-sm-12">{{app.buildLogs}}</textarea>
        </div>

      </div>
     */
  }
}
