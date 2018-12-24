import React, { Component } from "react";
import { Table } from "antd";

export default class UnusedImagesTable extends Component<{
  unusedImages: any;
  updateModel: (selectedIds: string[]) => void;
}> {
  getCols() {
    const columns = [
      {
        title: "Image Tag",
        dataIndex: "imageName"
      },
      {
        title: "Image ID",
        dataIndex: "imageId"
      }
    ];
    return columns;
  }

  getData() {
    const data: { key: string; imageName: string; imageId: string }[] = [];
    for (let index = 0; index < this.props.unusedImages.length; index++) {
      const element = this.props.unusedImages[index];
      data.push({
        key: element.id,
        imageId: element.id,
        imageName: element.description
      });
    }
    return data;
  }

  getRowSelection() {
    // rowSelection object indicates the need for row selection
    const self = this;
    const rowSelection = {
      onChange: (selectedRowKeys: any, selectedRows: any[]) => {
        self.props.updateModel(selectedRowKeys);
      },
      getCheckboxProps: (record: any) => ({
        disabled: false, // Column configuration not to be checked
        name: record.imageId
      })
    };
    return rowSelection;
  }

  render() {
    return (
      <div>
        <Table
          pagination={false}
          rowSelection={this.getRowSelection()}
          columns={this.getCols()}
          dataSource={this.getData()}
        />
      </div>
    );
  }
}
