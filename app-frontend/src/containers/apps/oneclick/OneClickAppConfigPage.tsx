import React, { Component } from "react";
import OneClickAppsApi from "../../../api/OneClickAppsApi";
import { RouteComponentProps } from "react-router";
import { IHashMapGeneric } from "../../../models/IHashMapGeneric";
import Toaster from "../../../utils/Toaster";
import { Row, Col, Card } from "antd";
import CenteredSpinner from "../../global/CenteredSpinner";
import OneClickVariablesSection, {
  IEnteredOneClickAppVariable
} from "./OneClickVariablesSection";

export interface IOneCLickVariable {
  id: string;
  label: string;
  defaultValue?: string;
  validRegex?: string;
  description?: string;
}

export interface IDockerComposeService {
  image: string;
  volumes?: string[];
  ports?: string[];
  environment?: IHashMapGeneric<string>;
  depends_on?: string[];
}

export interface IOneClickConfig {
  dockerCompose: {
    version: string;
    services: IHashMapGeneric<IDockerComposeService>;
  };
  instructions: {
    start: string;
    end: string;
  };
  variables: IOneCLickVariable[];
}

export default class OneClickAppConfigPage extends Component<
  RouteComponentProps<any>,
  {
    apiData: IOneClickConfig | undefined;
  }
> {
  constructor(props: any) {
    super(props);
    this.state = {
      apiData: undefined
    };
  }

  componentDidMount() {
    const self = this;
    new OneClickAppsApi()
      .getOneClickAppByName(this.props.match.params.appName)
      .then(function(data: IOneClickConfig) {
        self.setState({ apiData: data });
      })
      .catch(Toaster.createCatcher());
  }

  onNextClicked(values: IHashMapGeneric<string>) {
    // TODO
    alert("Deploying");
    console.log(values);
  }

  render() {
    const self = this;

    if (!this.state.apiData) {
      return <CenteredSpinner />;
    }

    const apiData = this.state.apiData!;

    return (
      <div>
        <Row type="flex" justify="center">
          <Col span={16}>
            <Card title={`Setup your ${this.props.match.params.appName}`}>
              <h2>{this.props.match.params.appName}</h2>
              <p style={{ whiteSpace: "pre-line" }}>
                {apiData.instructions.start}
              </p>
              <div style={{ height: 50 }} />
              <OneClickVariablesSection
                oneClickAppVariables={apiData.variables}
                onNextClicked={values => self.onNextClicked(values)}
              />
              <div style={{ height: 50 }} />
              <hr />><pre>{JSON.stringify(this.state.apiData, null, 2)}</pre>>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }
}
