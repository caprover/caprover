import React, { Component } from "react";
import { Row, Col, Input, Checkbox, Button } from "antd";

export default class NetDataSettingsForm extends Component<{
  netDataInfo: any;
  updateModel: (netDataInfo: any) => void;
}> {

  //TODO all fields require onchange: copy -> edit -> updateModel
  render() {
    return (
      <div>
        <h3>Notification Settings</h3>

        <p>
          NetData offers multiple ways for you to receive notifications if
          something is going wrong with your server resource usage.
          <i>All notification options are completely OPTIONAL.</i>
        </p>
        <hr />
        <br />
        <h4>Email (SMTP)</h4>

        <Row>
          <Col span={20} offset={2}>
            <Row type="flex" gutter={20} align="middle">
              <Col className="netdata-field" span={12}>
                Recipient Email
                <Input
                  type="text"
                  placeholder="alerts.receiver@example.com"
                  ng-model="netDataInfo.data.smtp.to"
                />
              </Col>

              <Col className="netdata-field" span={12}>
                Server Tag
                <Input
                  type="text"
                  placeholder="my-aws-server-01-anything"
                  ng-model="netDataInfo.data.smtp.hostname"
                />
              </Col>

              <Col className="netdata-field" span={12}>
                SMTP Server
                <Input
                  type="text"
                  placeholder="smtp.gmail.com"
                  ng-model="netDataInfo.data.smtp.server"
                />
              </Col>

              <Col className="netdata-field" span={6}>
                SMTP Port
                <Input
                  type="number"
                  ng-model="netDataInfo.data.smtp.port"
                  placeholder="587"
                />
              </Col>

              <Col className="netdata-field" span={6}>
                Unsecure
                <Checkbox ng-model="netDataInfo.data.smtp.allowNonTls">
                  allow non-TLS
                </Checkbox>
              </Col>

              <Col className="netdata-field" span={12}>
                SMTP Username
                <Input
                  type="text"
                  placeholder="alerts.receiver@example.com"
                  ng-model="netDataInfo.data.smtp.username"
                />
              </Col>

              <Col className="netdata-field" span={12}>
                SMTP password
                <Input
                  type="text"
                  placeholder="your password"
                  ng-model="netDataInfo.data.smtp.password"
                />
              </Col>
            </Row>
          </Col>
        </Row>
        <br />
        <h4>Slack</h4>
        <Row>
          <Col span={20} offset={2}>
            <Row type="flex" gutter={20} align="middle">
              <Col className="netdata-field" span={12}>
                Slack Webhook
                <Input
                  type="text"
                  placeholder="https://hooks.slack.com/services/XXXX"
                  ng-model="netDataInfo.data.slack.hook"
                />
              </Col>
              <Col className="netdata-field" span={12}>
                Slack Channel
                <Input
                  type="text"
                  placeholder="alertschannel"
                  ng-model="netDataInfo.data.slack.channel"
                />
              </Col>
            </Row>
          </Col>
        </Row>
        <br />
        <h4>Telegram</h4>
        <Row>
          <Col span={20} offset={2}>
            <Row type="flex" gutter={20} align="middle">
              <Col className="netdata-field" span={12}>
                Bot Token
                <Input
                  type="text"
                  placeholder="TELEGRAM_BOT_TOKEN"
                  ng-model="netDataInfo.data.telegram.botToken"
                />
              </Col>
              <Col className="netdata-field" span={12}>
                Chat ID
                <Input
                  type="text"
                  placeholder="Telegram Chat ID"
                  ng-model="netDataInfo.data.telegram.chatId"
                />
              </Col>
            </Row>
          </Col>
        </Row>
        <br />
        <h4>Push Bullet</h4>
        <Row>
          <Col span={20} offset={2}>
            <Row type="flex" gutter={20} align="middle">
              <Col className="netdata-field" span={12}>
                Push Bullet API token
                <Input
                  type="text"
                  placeholder="PUSH_BULLET_API_TOKEN"
                  ng-model="netDataInfo.data.pushBullet.apiToken"
                />
              </Col>
              <Col className="netdata-field" span={12}>
                Default Email (fallback receiver)
                <Input
                  type="text"
                  placeholder="alerts.receiver@example.com"
                  ng-model="netDataInfo.data.pushBullet.fallbackEmail"
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </div>
    );
  }
}
