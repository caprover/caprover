import React, { Component } from "react";
import { connect } from "react-redux";

class CurrentNodes extends Component<{
  defaultRegistryId: string | undefined;
}> {
  render() {
    return <div>CurrentNodes {this.props.defaultRegistryId}</div>;
  }
}

function mapStateToProps(state: any) {
  return {
    defaultRegistryId: state.registryReducer.defaultRegistryId
  };
}

export default connect(mapStateToProps)(CurrentNodes);
