import ApiManager from "../../../api/ApiManager";
import { IHashMapGeneric } from "../../../models/IHashMapGeneric";
import { IOneClickTemplate } from "./OneClickAppConfigPage";

export interface IDeploymentState {
  steps: string[];
  error: string;
  currentStep: number;
}

export default class OneClickAppDeployHelper {
  private apiManager: ApiManager;
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
    // JSON.stringfy
    // Replace
    // Re parse with error check
    // Start deploy
    // TODO
    alert("Deploying");
    console.log(values);

    this.onDeploymentStateChanged({
      steps: [],
      error: "",
      currentStep: 0
    });
  }
}
