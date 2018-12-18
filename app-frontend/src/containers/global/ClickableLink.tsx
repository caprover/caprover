import React, { Component, MouseEvent } from "react";

export default class ClickableLink extends Component<
  { onLinkClicked: Function },
  {}
> {
  handleClick(e: MouseEvent) {
    e.preventDefault();
    if (this.props.onLinkClicked) this.props.onLinkClicked();
  }

  render() {
    return <a onClick={e => this.handleClick(e)}>{this.props.children}</a>;
  }
}
