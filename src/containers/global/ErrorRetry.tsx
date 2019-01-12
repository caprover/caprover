import React, { Component } from "react";
import { Route } from "react-router";
import { Row, Button } from "antd";
import { connect } from "react-redux";
import { emitRootKeyChanged } from "../../actions/GlobalActions";

class ErrorRetry extends Component<any, {}> {
  render() {
    const self = this;
    return (
      <div style={{ textAlign: "center", padding: 36 }}>
        <p>An error occurred. Please try again.</p>
        <Row type="flex" justify="center">
          <Button
            type="primary"
            onClick={() => {
              self.props.emitRootKeyChanged();
            }}
          >
            Reload
          </Button>
        </Row>
      </div>
    );
  }
}

export default connect(
  undefined,
  {
    emitRootKeyChanged: emitRootKeyChanged
  }
)(ErrorRetry);
