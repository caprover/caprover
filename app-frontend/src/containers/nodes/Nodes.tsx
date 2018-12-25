import React, { Component } from "react";
import { connect } from "react-redux";
import AddNode from "./AddNode";
import { Alert } from "antd";

class CurrentNodes extends Component<{
  defaultRegistryId: string | undefined;
}> {
  render() {
    return (
      <div>
        {this.props.defaultRegistryId ? (
          <AddNode />
        ) : (
          <div>
            <Alert
              type="warning"
              showIcon={true}
              message="Cannot add more nodes as no default push registry is set. To add more nodes and create a cluster, you first need to add a docker registry and set it as the default push registry."
            />
          </div>
        )}
        <div style={{ height: 50 }} />
        CurrentNodes {this.props.defaultRegistryId}
      </div>
    );
  }
}

function mapStateToProps(state: any) {
  return {
    defaultRegistryId: state.registryReducer.defaultRegistryId
  };
}

export default connect(mapStateToProps)(CurrentNodes);
