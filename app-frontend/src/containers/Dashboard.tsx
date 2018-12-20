import React, { Component } from "react";
import { Tooltip, Row, Col, Card, Input, Button } from "antd";
import ApiComponent from "./global/ApiComponent";
import CenteredSpinner from "./global/CenteredSpinner";
import Toaster from "../utils/Toaster";
const Search = Input.Search;

export default class Dashboard extends ApiComponent<
  {},
  { isLoading: boolean; apiData: any }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      isLoading: true,
      apiData: undefined
    };
  }

  componentDidMount() {
    const self = this;
    this.apiManager
      .getCaptainInfo()
      .then(function(data: any) {
        self.setState({ isLoading: false, apiData: data });
      })
      .catch(function(err: Error) {
        Toaster.toast(err);
      });
  }

  render() {
    const self = this;

    if (self.state.isLoading) {
      return <CenteredSpinner />;
    }

    return (
      <div>
        {self.createInitialSetup()}
        <br />
        {self.createSetupPanel()}
      </div>
    );
  }

  createSetupPanel() {
    const self = this;
    return (
      <Row>
        <Col span={14} offset={5}>
          <Card title="Captain Root Domain Configurations">
            <div>
              <p>
                The very first thing that Captain needs is a root domain. For
                example, if you own <i>myawesomecompany.com</i>, you can use{" "}
                <i>captain.myawesomecompany.com</i> or{" "}
                <i>foo.bar.myawesomecompany.com</i> as your root domain. First,
                you need to make sure that the ip address for all subdomains of
                the root domain resolve to the Captain ip address. To do this,
                go to the DNS settings in your domain provider website, and set
                a wild card A entry.
                <br /> For example: <b> Type:</b> <u>A</u>,{" "}
                <b>Name (or host):</b> <u>*.captain</u>,
                <b> IP (or Points to):</b> <u>110.120.130.140</u> where this is
                the IP address of your captain machine.
              </p>
              <p>
                <i>
                  NOTE: DNS settings might take several hours to take into
                  effect. See{" "}
                  <a
                    href="https://ca.godaddy.com/help/what-factors-affect-dns-propagation-time-1746"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {" "}
                    here
                  </a>{" "}
                  for more details.
                </i>
              </p>
            </div>

            <hr />
            <br />

            <Row>
              <form>
                <div>
                  <p>
                    For example, if you set{" "}
                    <code>*.captainroot.example.com</code> to the IP address of
                    your server, just enter <code>captainroot.example.com</code>{" "}
                    in the box below:
                  </p>
                  <br />
                  <div>
                    <Search
                      addonBefore="[wildcard]&nbsp;."
                      disabled={self.state.apiData.hasRootSsl}
                      placeholder="captainroot.example.com"
                      defaultValue={self.state.apiData.rootDomain + ""}
                      enterButton="Update Domain"
                      size="large"
                      onSearch={value => console.log(value)}
                    />
                  </div>
                </div>
              </form>
              <br />
              <br />
              <Row type="flex" justify="end">
                <Tooltip title="Using Let's Encrypt Free Service">
                  <Button
                    uib-tooltip=""
                    disabled={
                      self.state.apiData.hasRootSsl ||
                      !self.state.apiData.hasCustomDomain
                    }
                  >
                    Enable HTTPS
                  </Button>
                </Tooltip>
                &nbsp;&nbsp;
                <Button
                  disabled={
                    !self.state.apiData.hasRootSsl ||
                    self.state.apiData.forceSsl
                  }
                >
                  Force HTTPS
                </Button>
              </Row>

              <div />
            </Row>
          </Card>
        </Col>
      </Row>
    );
  }

  createInitialSetup() {
    return (
      <Row>
        <Col span={18} offset={3}>
          <Card title="Captain Initial Setup">
            <div>
              <h3>Congratulations! 🎉🎉</h3>
              <p>
                <b /> You have installed CaptainDuckDuck successfully! You can
                set up your CaptainDuckDuck instance in two ways:
              </p>

              <ul>
                <li>
                  <b>Command Line Tool (RECOMMENDED): </b> just run
                  <br />
                  <code>npm i -g captainduckduck</code>
                  <br />
                  followed by
                  <br />
                  <code>captainduckduck serversetup</code>. Then follow the
                  guide.
                </li>
                <li>
                  <b>Use the panel below: </b> This is a non-guided version of
                  the Command Line method. Use this method only for the purpose
                  of experimentation.
                </li>
              </ul>
            </div>
          </Card>
        </Col>
      </Row>
    );
  }
}
