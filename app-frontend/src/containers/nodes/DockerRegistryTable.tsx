import React, { Component } from "react";
import { Table } from "antd";
import { IRegistryApi, IRegistryInfo } from "../../models/IRegistryInfo";

export default class DockerRegistryTable extends Component<{
  apiData: IRegistryApi;
  editRegistry: (dockerRegistry: IRegistryInfo) => void;
  deleteRegistry: (regId: string) => void;
}> {
  getCols() {
    const columns = [
      {
        title: "User",
        dataIndex: "registryUser"
      },
      {
        title: "Password",
        dataIndex: "registryPassword"
      },
      {
        title: "Domain",
        dataIndex: "registryDomain"
      },
      {
        title: "Image Prefix",
        dataIndex: "registryImagePrefix"
      }
    ];
    return columns;
  }

  render() {
    return (
      <div>
        <p>Docker Registries</p>
        <div>
          <Table
            pagination={false}
            columns={this.getCols()}
            dataSource={this.props.apiData.registries}
          />
        </div>
      </div>
    );
  }
}
