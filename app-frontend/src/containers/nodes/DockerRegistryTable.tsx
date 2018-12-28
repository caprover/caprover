import React, { Component } from "react";
import { Table, Icon, message, Modal, Input, Tooltip } from "antd";
import {
  IRegistryApi,
  IRegistryInfo,
  IRegistryTypes
} from "../../models/IRegistryInfo";
import ClickableLink from "../global/ClickableLink";
import Utils from "../../utils/Utils";
import { ColumnProps } from "antd/lib/table";

const EDITING_MODAL = "EDITING_MODAL";
const DELETING_MODAL = "DELETING_MODAL";

export default class DockerRegistryTable extends Component<
  {
    apiData: IRegistryApi;
    editRegistry: (dockerRegistry: IRegistryInfo) => void;
    deleteRegistry: (regId: string) => void;
  },
  {
    modalShowing: "EDITING_MODAL" | "DELETING_MODAL" | undefined;
    remoteRegistryToEdit: IRegistryInfo | undefined;
    registryIdToDelete: string | undefined;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      modalShowing: undefined,
      remoteRegistryToEdit: undefined,
      registryIdToDelete: undefined
    };
  }

  deleteRegistry(id: string) {
    if (id === this.props.apiData.defaultPushRegistryId) {
      Modal.warn({
        title: "Cannot Delete Default Push",
        content: (
          <div>
            This registry is set to be the default push. You cannot delete the
            default push registry. To remove, first you need to change the
            default push registry to another registry, or completely disable the
            default push registry. Then, come back and delete this.
          </div>
        )
      });
      return;
    }

    this.setState({
      registryIdToDelete: id,
      modalShowing: DELETING_MODAL
    });
  }

  editRegistry(dockerRegistry: IRegistryInfo) {
    if (dockerRegistry.registryType === IRegistryTypes.LOCAL_REG) {
      message.warn(
        "You cannot edit the self hosted registry. It is managed by Captain."
      );
      return;
    }

    this.setState({
      modalShowing: EDITING_MODAL,
      remoteRegistryToEdit: Utils.copyObject(dockerRegistry)
    });
  }

  getCols(): ColumnProps<IRegistryInfo>[] {
    const self = this;
    const columns = [
      {
        title: "User",
        dataIndex: "registryUser" as "registryUser"
      },
      {
        title: "Password",
        dataIndex: "registryPassword" as "registryPassword",
        render: (registryPassword: string) => {
          return <span>Edit to see.</span>;
        }
      },
      {
        title: "Domain",
        dataIndex: "registryDomain" as "registryDomain"
      },
      {
        title: "Image Prefix",
        dataIndex: "registryImagePrefix" as "registryImagePrefix"
      },
      {
        title: "Actions",
        dataIndex: "id" as "id",
        render: (id: string, reg: IRegistryInfo) => {
          return (
            <span>
              <ClickableLink
                onLinkClicked={() => {
                  self.editRegistry(reg);
                }}
              >
                <Icon type="form" />
              </ClickableLink>
              &nbsp;&nbsp;&nbsp;&nbsp;
              <ClickableLink
                onLinkClicked={() => {
                  self.deleteRegistry(reg.id);
                }}
              >
                <Icon type="delete" />
              </ClickableLink>
            </span>
          );
        }
      }
    ];
    return columns;
  }

  createEditModalContent() {
    const self = this;

    return (
      <div style={{ maxWidth: 360 }}>
        <Input
          addonBefore="Username"
          placeholder="username | email@gmail.com"
          type="email"
          value={self.state.remoteRegistryToEdit!.registryUser}
          onChange={e => {
            const newData = Utils.copyObject(self.state.remoteRegistryToEdit!);
            newData.registryUser = e.target.value.trim();
            self.setState({ remoteRegistryToEdit: newData });
          }}
        />
        <div style={{ height: 20 }} />
        <Input
          addonBefore="Password"
          placeholder="mypassword"
          type="text"
          value={self.state.remoteRegistryToEdit!.registryPassword}
          onChange={e => {
            const newData = Utils.copyObject(self.state.remoteRegistryToEdit!);
            newData.registryPassword = e.target.value;
            self.setState({ remoteRegistryToEdit: newData });
          }}
        />
        <div style={{ height: 20 }} />
        <Input
          addonBefore="Domain"
          placeholder="registry-1.docker.io"
          type="text"
          value={self.state.remoteRegistryToEdit!.registryDomain}
          onChange={e => {
            const newData = Utils.copyObject(self.state.remoteRegistryToEdit!);
            newData.registryDomain = e.target.value.trim();
            self.setState({ remoteRegistryToEdit: newData });
          }}
        />
        <div style={{ height: 20 }} />
        <Input
          addonBefore="Image Prefix"
          placeholder="username"
          addonAfter={
            <Tooltip title="Your images will be tagged as RegistryDomain/ImagePrefix/ImageName. For most providers, Image Prefix is exactly your username, unless the field DOMAIN is specific to you, in that case, this prefix is empty.">
              <Icon type="info-circle" />
            </Tooltip>
          }
          type="text"
          value={self.state.remoteRegistryToEdit!.registryImagePrefix}
          onChange={e => {
            const newData = Utils.copyObject(self.state.remoteRegistryToEdit!);
            newData.registryImagePrefix = e.target.value.trim();
            self.setState({ remoteRegistryToEdit: newData });
          }}
        />
      </div>
    );
  }

  render() {
    const self = this;
    return (
      <div>
        <Modal
          title="Confirm Delete"
          okText="Delete Registry"
          onCancel={() => self.setState({ modalShowing: undefined })}
          onOk={() => {
            self.setState({ modalShowing: undefined });
            self.props.deleteRegistry(self.state.registryIdToDelete!);
          }}
          visible={self.state.modalShowing === DELETING_MODAL}
        >
          Are you sure you want to remote this registry from your list. You will
          no longer be able to push to or pull from this registry.
        </Modal>
        <Modal
          title="Edit Registry"
          okText="Save and Update"
          onCancel={() => self.setState({ modalShowing: undefined })}
          onOk={() => {
            self.setState({ modalShowing: undefined });
            self.props.editRegistry(
              Utils.copyObject(self.state.remoteRegistryToEdit!)
            );
          }}
          visible={self.state.modalShowing === EDITING_MODAL}
        >
          {self.state.remoteRegistryToEdit ? (
            self.createEditModalContent()
          ) : (
            <div />
          )}
        </Modal>
        <h3>Docker Registries</h3>
        <div>
          <Table
            rowKey="id"
            pagination={false}
            columns={this.getCols()}
            dataSource={this.props.apiData.registries}
          />
        </div>
      </div>
    );
  }
}
