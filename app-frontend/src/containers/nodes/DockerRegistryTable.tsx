import React, { Component } from "react";
import { Table, Icon, message, Modal } from "antd";
import {
  IRegistryApi,
  IRegistryInfo,
  IRegistryTypes
} from "../../models/IRegistryInfo";
import ClickableLink from "../global/ClickableLink";
import Utils from "../../utils/Utils";

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

  getCols() {
    const self = this;
    const columns = [
      {
        title: "User",
        dataIndex: "registryUser"
      },
      {
        title: "Password",
        dataIndex: "registryPassword",
        render: (registryPassword: string) => {
          return <span>Edit to see.</span>;
        }
      },
      {
        title: "Domain",
        dataIndex: "registryDomain"
      },
      {
        title: "Image Prefix",
        dataIndex: "registryImagePrefix"
      },
      {
        title: "Actions",
        dataIndex: "id",
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
          Deleting
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
          Editing
        </Modal>
        <p>Docker Registries</p>
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
