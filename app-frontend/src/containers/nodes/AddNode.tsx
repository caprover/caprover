import React, { Component } from "react";
import { Card, Row, Col, Input, Button, Icon, Radio, Tooltip } from "antd";
import Utils from "../../utils/Utils";

export interface INodeToAdd {
  remoteNodeIpAddress: string;
  captainIpAddress: string;
  nodeType: string;
  privateKey: string;
}

export default class AddNode extends Component<
  { onAddNodeClicked: (nodeToAdd: INodeToAdd) => void },
  {
    nodeToAdd: INodeToAdd;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      nodeToAdd: {
        remoteNodeIpAddress: "",
        captainIpAddress: "",
        nodeType: "worker",
        privateKey: ""
      }
    };
  }

  changeModel(childField: string, value: string) {
    const nodeToAdd = Utils.copyObject(this.state.nodeToAdd) as any;
    nodeToAdd[childField] = value;
    this.setState({ nodeToAdd });
  }

  render() {
    const self = this;
    const nodeToAdd = self.state.nodeToAdd;

    return (
      <div>
        <Card style={{ marginTop: 16 }} type="inner" title="Attach New Node">
          <Row type="flex" justify="space-between">
            <Col span={11}>
              <Input
                style={{ marginBottom: 10 }}
                addonBefore="New node IP Address"
                placeholder="123.123.123.123"
                type="text"
                value={nodeToAdd.remoteNodeIpAddress}
                onChange={e =>
                  self.changeModel("remoteNodeIpAddress", e.target.value)
                }
              />
            </Col>
            <Col span={11}>
              <Input
                style={{ marginBottom: 10 }}
                addonBefore="Captain IP Address"
                placeholder="123.123.123.123"
                type="text"
                value={nodeToAdd.captainIpAddress}
                onChange={e =>
                  self.changeModel("captainIpAddress", e.target.value)
                }
              />
            </Col>
            <Col span={24} style={{ marginTop: 10 }}>
              <div style={{ paddingBottom: 5 }}>
                &nbsp;SSH Private Key for <b>root</b> user
              </div>
              <Input.TextArea
                style={{ marginBottom: 20 }}
                className="code-input"
                rows={6}
                placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIICWwIBAAKBgQDArfs81aizq8ckg16e+ewFgJg7J..."
                value={nodeToAdd.privateKey}
                onChange={e => self.changeModel("privateKey", e.target.value)}
              />
            </Col>
          </Row>
          <Row type="flex" justify="end">
            <Radio.Group
              defaultValue="a"
              buttonStyle="outline"
              style={{ marginBottom: 20 }}
              value={nodeToAdd.nodeType}
              onChange={e => self.changeModel("nodeType", e.target.value)}
            >
              <Radio.Button value="worker">Join as worker node</Radio.Button>
              <Radio.Button value="manager">Join as manager node</Radio.Button>
            </Radio.Group>
            &nbsp;
            <Tooltip title="Tip: For every 5 workers, add 2 manager nodes, keeping manager node count as an odd number. Therefore, use worker node for the first 4 nodes you add to your cluster.">
              <Icon
                style={{ paddingTop: 8, paddingLeft: 8 }}
                type="info-circle"
              />
            </Tooltip>
          </Row>

          <Row type="flex" justify="end">
            <Button type="primary" onClick={() => self.props.onAddNodeClicked(self.state.nodeToAdd)}>
              <Icon type="cluster" /> &nbsp; Join Cluster
            </Button>
          </Row>
        </Card>
      </div>
    );
  }
}
