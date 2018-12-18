import React, { Component } from "react";
import { Spin, Icon } from "antd";

export default class CenteredSpinner extends Component {
  render() {
    const antIcon = <Icon type="loading" style={{ fontSize: 32 }} spin />;

    return (
      <div
        style={{
          width: "100%",
          textAlign: "center"
        }}
      >
        <Spin
          style={{
            marginTop: 60,
            marginBottom: 60,
            width: "100%"
          }}
          indicator={antIcon}
          size="large"
        />
      </div>
    );
  }
}
