import React, { Component } from "react";
import { Row, Col, Input, Checkbox, Button } from "antd";
import Utils from "../../utils/Utils";

export default class NetDataSettingsForm extends Component<{
  netDataInfo: any;
  updateModel: (netDataInfo: any) => void;
}> {
  changeModel(
    parentField: string,
    childField: string,
    value: string | boolean
  ) {
    const netDataInfo = Utils.copyObject(this.props.netDataInfo);
    const netDataInfoData = netDataInfo.data;
    if (!netDataInfoData[parentField]) {
      netDataInfoData[parentField] = {};
    }
    netDataInfoData[parentField][childField] = value;
    this.props.updateModel(netDataInfo);
  }

  render() {
    const self = this;
    const netDataInfo = this.props.netDataInfo;
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
                  value={netDataInfo.data.smtp.to}
                  onChange={e => self.changeModel("smtp", "to", e.target.value)}
                />
              </Col>

              <Col className="netdata-field" span={12}>
                Server Tag
                <Input
                  type="text"
                  placeholder="my-aws-server-01-anything"
                  value={netDataInfo.data.smtp.hostname}
                  onChange={e =>
                    self.changeModel("smtp", "hostname", e.target.value)
                  }
                />
              </Col>

              <Col className="netdata-field" span={12}>
                SMTP Server
                <Input
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={netDataInfo.data.smtp.server}
                  onChange={e =>
                    self.changeModel("smtp", "server", e.target.value)
                  }
                />
              </Col>

              <Col className="netdata-field" span={6}>
                SMTP Port
                <Input
                  type="number"
                  placeholder="587"
                  value={netDataInfo.data.smtp.port}
                  onChange={e =>
                    self.changeModel("smtp", "port", e.target.value)
                  }
                />
              </Col>

              <Col className="netdata-field" span={6}>
                Unsecure
                <Checkbox
                  checked={!!netDataInfo.data.smtp.allowNonTls}
                  onChange={e =>
                    self.changeModel("smtp", "allowNonTls", e.target.checked)
                  }
                >
                  allow non-TLS
                </Checkbox>
              </Col>

              <Col className="netdata-field" span={12}>
                SMTP Username
                <Input
                  type="text"
                  placeholder="alerts.receiver@example.com"
                  value={netDataInfo.data.smtp.username}
                  onChange={e =>
                    self.changeModel("smtp", "username", e.target.value)
                  }
                />
              </Col>

              <Col className="netdata-field" span={12}>
                SMTP password
                <Input
                  type="text"
                  placeholder="your password"
                  value={netDataInfo.data.smtp.password}
                  onChange={e =>
                    self.changeModel("smtp", "password", e.target.value)
                  }
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
                  value={netDataInfo.data.slack.hook}
                  onChange={e =>
                    self.changeModel("slack", "hook", e.target.value)
                  }
                />
              </Col>
              <Col className="netdata-field" span={12}>
                Slack Channel
                <Input
                  type="text"
                  placeholder="alertschannel"
                  value={netDataInfo.data.slack.channel}
                  onChange={e =>
                    self.changeModel("slack", "channel", e.target.value)
                  }
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
                  value={netDataInfo.data.telegram.botToken}
                  onChange={e =>
                    self.changeModel("telegram", "botToken", e.target.value)
                  }
                />
              </Col>
              <Col className="netdata-field" span={12}>
                Chat ID
                <Input
                  type="text"
                  placeholder="Telegram Chat ID"
                  value={netDataInfo.data.telegram.chatId}
                  onChange={e =>
                    self.changeModel("telegram", "chatId", e.target.value)
                  }
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
                  value={netDataInfo.data.pushBullet.apiToken}
                  onChange={e =>
                    self.changeModel("pushBullet", "apiToken", e.target.value)
                  }
                />
              </Col>
              <Col className="netdata-field" span={12}>
                Default Email (fallback receiver)
                <Input
                  type="text"
                  placeholder="alerts.receiver@example.com"
                  value={netDataInfo.data.pushBullet.fallbackEmail}
                  onChange={e =>
                    self.changeModel(
                      "pushBullet",
                      "fallbackEmail",
                      e.target.value
                    )
                  }
                />
              </Col>
            </Row>
          </Col>
        </Row>
      </div>
    );
  }
}
