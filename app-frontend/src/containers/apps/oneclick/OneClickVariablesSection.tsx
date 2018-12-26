import React, { Component } from "react";
import { IOneCLickVariable } from "./OneClickAppConfigPage";
import { Input, Row, Col, Alert, Button, message } from "antd";
import { IHashMapGeneric } from "../../../models/IHashMapGeneric";
import Utils from "../../../utils/Utils";

export interface IEnteredOneClickAppVariable {
  id: string;
  value: string;
}

export default class OneClickVariablesSection extends Component<
  {
    oneClickAppVariables: IOneCLickVariable[];
    onNextClicked: (values: IHashMapGeneric<string>) => void;
  },
  {
    variables: IHashMapGeneric<string>;
    blurredFields: IHashMapGeneric<boolean>;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      variables: {},
      blurredFields: {}
    };
  }

  changeModel(id: string, value: string) {
    const newModel = Utils.copyObject(this.state.variables);
    newModel[id] = value;
    this.setState({ variables: newModel });
  }

  onNextClicked() {
    const self = this;
    const blurredFields = Utils.copyObject(self.state.blurredFields);
    let allFieldValid = true;
    self.props.oneClickAppVariables.forEach(v => {
      blurredFields[v.id] = true;
      if (!self.isFieldValueValid(v)) {
        allFieldValid = false;
      }
    });

    if (!allFieldValid) {
      message.error("Fix all errors before deploying.");
    } else {
      self.props.onNextClicked(self.state.variables);
    }
    self.setState({ blurredFields });
  }

  isFieldValueValid(variable: IOneCLickVariable) {
    const self = this;
    const currVal = self.state.variables[variable.id];
    let isEnteredValueValid = true;
    if (variable.validRegex) {
      // From https://stackoverflow.com/questions/39154255/converting-regexp-to-string-then-back-to-regexp
      let parts = /\/(.*)\/(.*)/.exec(variable.validRegex);
      if (
        !parts /*This should never happen!*/ ||
        !new RegExp(parts[1], parts[2]).test(currVal)
      ) {
        isEnteredValueValid = false;
      }
    }

    return isEnteredValueValid;
  }

  createTextFields() {
    const self = this;
    return this.props.oneClickAppVariables.map(variable => {
      const currVal = self.state.variables[variable.id];

      return (
        <div key={variable.id} style={{ marginBottom: 30 }}>
          <h4>{variable.label}</h4>
          <Input
            type="text"
            placeholder={variable.defaultValue}
            value={currVal === undefined ? variable.defaultValue : currVal}
            onChange={e => self.changeModel(variable.id, e.target.value)}
            onBlur={e => {
              const blurredFields = Utils.copyObject(self.state.blurredFields);
              blurredFields[variable.id] = true;
              self.setState({ blurredFields });
            }}
          />
          <div style={{ height: 5 }} />
          <Alert
            className={
              !self.state.blurredFields[variable.id] ||
              self.isFieldValueValid(variable)
                ? "hide-on-demand"
                : ""
            }
            showIcon
            message={
              <span>
                Invalid value. Does not match Regex:
                <code>{variable.validRegex}</code>
              </span>
            }
            type="error"
          />
        </div>
      );
    });
  }

  render() {
    const self = this;
    return (
      <div>
        <Row>
          <Col span={12}>
            <div>{this.createTextFields()}</div>
          </Col>
        </Row>
        <Row type="flex" justify="end">
          <Button
            size="large"
            style={{ minWidth: 150 }}
            type="primary"
            onClick={() => self.onNextClicked()}
          >
            Deploy
          </Button>
        </Row>
        <pre>{JSON.stringify(this.props.oneClickAppVariables, null, 2)}</pre>
      </div>
    );
  }
}
