import React, { Component } from "react";
import { Modal } from "antd";

export default class ReloadCaptainModal extends Component<
  {
    isRefreshTimerActivated: boolean;
  },
  { timeToRefresh: number }
> {
  private hasAlreadyActivated: boolean;
  constructor(props: any) {
    super(props);
    this.hasAlreadyActivated = false;
    this.state = {
      timeToRefresh: 0
    };
  }

  startTimer() {
    const self = this;
    self.setState({ timeToRefresh: 30 });
    setInterval(function() {
      if (self.state.timeToRefresh < 2) {
        window.location.reload(true);
        return;
      }
      self.setState({ timeToRefresh: self.state.timeToRefresh - 1 });
    }, 1000);
  }

  render() {
    const self = this;
    if (self.props.isRefreshTimerActivated && !this.hasAlreadyActivated) {
      this.hasAlreadyActivated = true;
      setTimeout(() => self.startTimer(), 10);
    }

    return (
      <div>
        <Modal
          closable={false}
          footer={<div />}
          title="Update Process Started"
          visible={self.state.timeToRefresh > 0}
        >
          <div>
            {self.props.children}
            <p>
              <b>Time to Refresh: </b>
              {this.state.timeToRefresh}
            </p>
          </div>
        </Modal>
      </div>
    );
  }
}
