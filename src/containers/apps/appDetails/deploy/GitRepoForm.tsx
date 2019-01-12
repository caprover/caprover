import React, { Component } from "react";
import { Row, Col, Form, Input } from "antd";
import { RepoInfo } from "../../AppDefinition";
import Utils from "../../../../utils/Utils";

export default class GitRepoForm extends Component<{
  gitRepoValues: RepoInfo;
  updateRepoInfo: (newRepoInfo: RepoInfo) => void;
}> {
  render() {
    return (
      <div>
        <form action="/" autoComplete="off">
          <Row gutter={20}>
            <Col span={12}>
              <Input
                style={{ marginBottom: 20 }}
                value={this.props.gitRepoValues.repo}
                addonBefore="Repository"
                placeholder="github.com/someone/something"
                type="url"
                spellCheck={false}
                autoCorrect="off"
                autoComplete="off"
                autoCapitalize="off"
                onChange={e => {
                  const newObj = Utils.copyObject(this.props.gitRepoValues);
                  newObj.repo = e.target.value;
                  this.props.updateRepoInfo(newObj);
                }}
              />
            </Col>
            <Col span={12}>
              <Input
                style={{ marginBottom: 20 }}
                value={this.props.gitRepoValues.branch}
                addonBefore={<span>Branch&nbsp;&nbsp;&nbsp;&nbsp;</span>}
                placeholder="master"
                type="text"
                spellCheck={false}
                autoCorrect="off"
                autoComplete="off"
                autoCapitalize="off"
                onChange={e => {
                  const newObj = Utils.copyObject(this.props.gitRepoValues);
                  newObj.branch = e.target.value;
                  this.props.updateRepoInfo(newObj);
                }}
              />
            </Col>
            <Col span={12}>
              <Input
                style={{ marginBottom: 20 }}
                value={this.props.gitRepoValues.user}
                addonBefore={<span>Username&nbsp;</span>}
                placeholder="myemail@gmail.com"
                type="email"
                onChange={e => {
                  const newObj = Utils.copyObject(this.props.gitRepoValues);
                  newObj.user = e.target.value;
                  this.props.updateRepoInfo(newObj);
                }}
              />
            </Col>
            <Col span={12}>
              <Input
                style={{ marginBottom: 20 }}
                value={this.props.gitRepoValues.password}
                addonBefore="Password"
                placeholder="githubpassword"
                spellCheck={false}
                autoCorrect="off"
                autoComplete="off"
                autoCapitalize="off"
                type="text"
                onChange={e => {
                  const newObj = Utils.copyObject(this.props.gitRepoValues);
                  newObj.password = e.target.value;
                  this.props.updateRepoInfo(newObj);
                }}
              />
            </Col>
          </Row>
        </form>
      </div>
    );
  }
}
