import React, { Component } from "react";
import ApiComponent from "../global/ApiComponent";
import { Input, Button, Row, message } from "antd";
import Toaster from "../../utils/Toaster";
import CenteredSpinner from "../global/CenteredSpinner";

export default class ChangePass extends ApiComponent<
  {},
  { isLoading: boolean; old: string; new1: string; new2: string }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      isLoading: false,
      old: "",
      new1: "",
      new2: ""
    };
  }

  onChangePasswordClicked() {
    const self = this;
    if (!this.state.new1) {
      message.error("New password cannot be empty");
      return;
    }

    if (this.state.new1 !== this.state.new2) {
      message.error("New passwords confirm does not match");
      return;
    }

    this.setState({ isLoading: true });

    this.apiManager
      .changePass(this.state.old, this.state.new1)
      .catch(Toaster.createCatcher())
      .then(function(data) {
        self.setState({ isLoading: false });
      });
  }

  render() {
    if (this.state.isLoading) {
      return <CenteredSpinner />;
    }

    return (
      <div>
        Old Password
        <Input
          type="password"
          onChange={e => this.setState({ old: e.target.value })}
        />
        <div style={{ height: 20 }} />
        <hr />
        <div style={{ height: 20 }} />
        New Password
        <Input
          type="password"
          onChange={e => this.setState({ new1: e.target.value })}
        />
        <div style={{ height: 20 }} />
        Confirm New Password
        <Input
          type="password"
          onChange={e => this.setState({ new2: e.target.value })}
        />
        <div style={{ height: 40 }} />
        <Row type="flex" justify="end">
          <Button onClick={() => this.onChangePasswordClicked()} type="primary">
            Change Password
          </Button>
        </Row>
      </div>
    );
  }
}
