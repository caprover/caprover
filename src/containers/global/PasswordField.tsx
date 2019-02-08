import React, { Component, Fragment } from "react";
import { Row, Button, Input } from "antd";

export default class PasswordField extends Component<
  {
    placeholder?: string;
    addonBefore?: string;
    defaultValue: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  },
  any
> {
  constructor(props: any) {
    super(props);
    this.state = {
      isShowing: !props.defaultValue
    };
  }

  render() {
    const self = this;
    return (
      <Fragment>
        {self.state.isShowing ? self.createInput() : self.createButton()}
      </Fragment>
    );
  }

  createButton() {
    const self = this;
    return (
      <Button
        style={{ width: "100%" }}
        onClick={() => {
          self.setState({ isShowing: true });
        }}
      >
        Show Password
      </Button>
    );
  }

  createInput() {
    const self = this;
    return (
      <Input
        type="text"
        spellCheck={false}
        autoCorrect="off"
        autoComplete="off"
        autoCapitalize="off"
        placeholder={self.props.placeholder}
        addonBefore={self.props.addonBefore}
        defaultValue={self.props.defaultValue}
        onChange={e => self.props.onChange(e)}
      />
    );
  }
}
