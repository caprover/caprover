import React, { Component } from "react";
import { connect } from "react-redux";
import AddNode, { INodeToAdd } from "./AddNode";
import { Alert, Row, Col, Divider, message } from "antd";
import ApiComponent from "../global/ApiComponent";
import Toaster from "../../utils/Toaster";
import CenteredSpinner from "../global/CenteredSpinner";

class CurrentNodes extends ApiComponent<
  {
    defaultRegistryId: string | undefined;
  },
  { apiData: any }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      apiData: undefined
    };
  }

  fetchData() {
    const self = this;
    self.setState({ apiData: undefined });
    self.apiManager
      .getAllNodes()
      .then(function(data) {
        self.setState({ apiData: data });
      })
      .catch(Toaster.createCatcher());
  }

  addNode(nodeToAdd: INodeToAdd) {
    const self = this;
    self.setState({ apiData: undefined });
    self.apiManager
      .addDockerNode(
        nodeToAdd.nodeType,
        nodeToAdd.privateKey,
        nodeToAdd.remoteNodeIpAddress,
        nodeToAdd.captainIpAddress
      )
      .then(function() {
        message.success("Node added successfully!");
      })
      .catch(Toaster.createCatcher())
      .then(function(data) {
        self.fetchData();
      });
  }

  componentDidMount() {
    this.fetchData();
  }

  createNodes() {
    const nodes: any[] = this.state.apiData.nodes || [];

    return nodes.map(node => {
      return (
        <div
          key={node.nodeId}
          style={{
            paddingTop: 15,
            paddingBottom: 20,
            paddingRight: 20,
            paddingLeft: 20,
            marginBottom: 40,
            borderRadius: 5,
            border: "1px solid #dddddd",
            backgroundColor: "#fcfcfc"
          }}
        >
          <Row type="flex" justify="center">
            <b>Node ID:&nbsp;&nbsp;</b> {node.nodeId}
          </Row>
          <hr />
          <div style={{ height: 10 }} />
          <Row>
            <Col span={12}>
              <b>Type: </b>
              {node.isLeader ? "Leader (Main Node)" : node.type}
            </Col>
            <Col span={12}>
              <b>IP: </b>
              {node.ip}
            </Col>
          </Row>
          <Row>
            <Col span={12}>
              <b>State: </b>
              {node.state}
            </Col>
            <Col span={12}>
              <b>Status: </b>
              {node.status}
            </Col>
          </Row>
          <br />
          <Row>
            <Col span={12}>
              <b>RAM: </b>
              {(node.memoryBytes / 1073741824).toFixed(2)} GB
            </Col>
            <Col span={12}>
              <b>OS: </b>
              {node.operatingSystem}
            </Col>
          </Row>
          <Row>
            <Col span={12}>
              <b>CPU: </b>
              {(node.nanoCpu / 1000000000).toFixed(0)} cores
            </Col>
            <Col span={12}>
              <b>Architecture: </b>
              {node.architecture}
            </Col>
          </Row>
          <br />
          <Row>
            <Col span={12}>
              <b>Hostname: </b>
              {node.hostname}
            </Col>
            <Col span={12}>
              <b>Docker Version: </b>
              {node.dockerEngineVersion}
            </Col>
          </Row>
        </div>
      );
    });

    // "ip":"199.195.150.96"
    // "nodeId":"i9lccwa92dfyy9kpkktw2okll"

    // ,"type":"manager"
    // ,"isLeader":true,
    // ,"state":"ready",
    // "status":"active"

    // "hostname":"kasra-X550JK"
    // "dockerEngineVersion":"18.09.1-rc1",

    // "memoryBytes":8241434624,
    // operatingSystem":"linux",
    // "nanoCpu":8000000000,
    // ,"architecture":"x86_64","
  }

  render() {
    const self = this;
    if (!this.state.apiData) {
      return <CenteredSpinner />;
    }

    return (
      <div>
        {this.props.defaultRegistryId ? (
          <AddNode
            onAddNodeClicked={nodeToAdd => {
              self.addNode(nodeToAdd);
            }}
          />
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

        <Divider type="horizontal">
          <h4>Current Cluster Nodes</h4>
        </Divider>
        <div style={{ height: 30 }} />

        <Row type="flex" justify="center">
          <Col span={14}>{self.createNodes()}</Col>
        </Row>
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
