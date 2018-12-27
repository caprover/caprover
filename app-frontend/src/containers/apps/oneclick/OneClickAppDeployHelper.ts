import ApiManager from "../../../api/ApiManager";
import { IHashMapGeneric } from "../../../models/IHashMapGeneric";
import {
  IOneClickTemplate,
  IDockerComposeService
} from "./OneClickAppConfigPage";

const REGISTERING = "REGISTERING";
const CONFIGURING = "CONFIGURING";
const DEPLOYING = "DEPLOYING";

export interface IDeploymentState {
  steps: string[];
  error: string;
  currentStep: number;
}

export default class OneClickAppDeployHelper {
  private apiManager: ApiManager;
  private template: IOneClickTemplate | undefined;
  constructor(
    private onDeploymentStateChanged: (
      deploymentState: IDeploymentState
    ) => void
  ) {
    this.apiManager = new ApiManager();
  }

  startDeployProcess(
    template: IOneClickTemplate,
    values: IHashMapGeneric<string>
  ) {
    let stringified = JSON.stringify(template);

    for (let index = 0; index < template.variables.length; index++) {
      const element = template.variables[index];
      stringified = stringified
        .split(element.id)
        .join(values[element.id] || "");
    }

    try {
      this.template = JSON.parse(stringified);
    } catch (error) {
      this.onDeploymentStateChanged({
        steps: ["Parsing the template"],
        error: `Cannot parse: ${stringified}` + "\n\n\n\n" + error,
        currentStep: 0
      });
      return;
    }

    alert("TODO");
    // Dependency tree
    // Create steps as promises
    // Start running promises, each promise will update the progress state automatically

    this.onDeploymentStateChanged({
      steps: ["Parsing the template"],
      error: "",
      currentStep: 0
    });
  }

  createStep(appName: string, step: string) {
    return appName + " " + step;
  }

  onStepCompleted(appName: string, step: string) {}

  deployApp(appName: string, dockerComposeService: IDockerComposeService) {}
}
