import React, { Component } from "react";
import { Form, Icon, Input, Button, Checkbox, Card } from "antd";
import ApiComponent from "./global/ApiComponent";
import Toaster from "../utils/Toaster";
import ApiManager from "../api/ApiManager";
import { RouteComponentProps } from "react-router";
const FormItem = Form.Item;

export default class Login extends ApiComponent<RouteComponentProps<any>> {
  onLoginRequested(password: string) {
    const self = this;
    this.apiManager
      .getAuthToken(password)
      .then(function(data) {
        self.apiManager.setAuthToken(data.token);
        self.props.history.push("/");
      })
      .catch(Toaster.createCatcher());
  }

  render() {
    const self = this;
    return (
      <div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)"
          }}
        >
          <Card title="CaptainDuckDuck" style={{ width: 300 }}>
            <WrappedNormalLoginForm
              onLoginRequested={(password: string) =>
                self.onLoginRequested(password)
              }
            />
          </Card>
        </div>
      </div>
    );
  }
}

class NormalLoginForm extends React.Component<any, any> {
  handleSubmit = (e: any) => {
    const self = this;
    e.preventDefault();
    this.props.form.validateFields((err: any, values: any) => {
      if (!err) {
        self.props.onLoginRequested(values.password);
      }
    });
  };

  render() {
    const { getFieldDecorator } = this.props.form;
    return (
      <Form onSubmit={this.handleSubmit} className="login-form">
        <FormItem>
          {getFieldDecorator("password", {
            rules: [{ required: true, message: "Please input your Password!" }]
          })(
            <Input
              prefix={<Icon type="lock" style={{ color: "rgba(0,0,0,.25)" }} />}
              type="password"
              placeholder="Password"
            />
          )}
        </FormItem>
        <FormItem>
          <Button
            style={{ float: "right" }}
            type="primary"
            htmlType="submit"
            className="login-form-button"
          >
            Login
          </Button>
        </FormItem>
      </Form>
    );
  }
}

const WrappedNormalLoginForm = Form.create()(NormalLoginForm);
