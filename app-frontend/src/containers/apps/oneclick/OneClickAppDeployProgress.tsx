import React, { Component } from "react";
import { IDeploymentState } from "./OneClickAppDeployHelper";

export default class OneClickAppDeployProgress extends Component<{
  deploymentState: IDeploymentState;
}> {
  render() {
    return (
      <div>
        <h3>OneClickAppDeployProgress</h3>
        <pre>{JSON.stringify(this.props.deploymentState, null, 2)}</pre>
      </div>
    );
  }
}
