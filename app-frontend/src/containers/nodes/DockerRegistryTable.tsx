import React, { Component } from "react";

export default class DockerRegistryTable extends Component<{
  apiData: any;
  editRegistry: (dockerRegistry: any) => void;
  deleteRegistry: (regId: string) => void;
}> {
  render() {
    return (
      <div>
        <p>DockerRegistryTable</p>
      </div>
    );
  }
}
