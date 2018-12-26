import React, { Component } from "react";
import { Table } from "antd";
import { ColumnProps } from "antd/lib/table";
import { IUnusedImage } from "./DiskCleanup";

export default class UnusedImagesTable extends Component<{
  unusedImages: IUnusedImage[];
  updateModel: (selectedIds: string[]) => void;
}> {
  getCols(): ColumnProps<{ imageName: string; imageId: string }>[] {
    const columns = [
      {
        title: "Image ID",
        dataIndex: "imageId" as "imageId",
        render: (imageId: string) => {
          imageId = imageId || "";
          return (
            <div style={{ width: 150, fontSize: "90%" }}>
              {imageId.substr(0, Math.min(imageId.length, 25))}...
            </div>
          );
        }
      },
      {
        title: "Associated Tags",
        dataIndex: "imageName" as "imageName",
        render: (imageName: string) => {
          imageName = imageName || "";
          return (
            <div style={{ whiteSpace: "pre-line", fontSize: "90%" }}>
              {imageName}
            </div>
          );
        }
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
        imageName: element.tags.join("\n")
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
