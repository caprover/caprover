import React, { Component } from "react";

export default class DefaultDockerRegistry extends Component<{
  apiData: any;
  changeDefault: (regId: string) => void;
}> {
  render() {
    return <div>DefaultDockerRegistry</div>;
  }
}
