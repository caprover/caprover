import ApiManager from "../../../api/ApiManager";
import { IHashMapGeneric } from "../../../models/IHashMapGeneric";
import {
  IOneClickTemplate,
  IDockerComposeService
} from "./OneClickAppConfigPage";
import Utils from "../../../utils/Utils";

const REGISTERING = "REGISTERING";
const CONFIGURING = "CONFIGURING";
const DEPLOYING = "DEPLOYING";

interface IDeploymentStep {
  stepName: string;
  stepPromise: Promise<void>;
}

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
    const self = this;
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

    // Dependency tree and sort apps
    // Call createDeploymentStepPromises for all apps.
    // populate steps as string[]
    // create promise chain with catch -> error. Each promise gets followed by currentStep++ promise
    // Start running promises,

    const apps = this.createAppsArrayInOrder();
    if (!apps) {
      self.onDeploymentStateChanged({
        steps: ["Parsing the template"],
        error:
          "Cannot parse the template. Dependency tree cannot be resolved. Infinite loop!!",
        currentStep: 0
      });
    } else if (apps.length === 0) {
      self.onDeploymentStateChanged({
        steps: ["Parsing the template"],
        error: "Cannot parse the template. No services found!!",
        currentStep: 0
      });
    } else {
      const steps: IDeploymentStep[] = [];
      for (let index = 0; index < apps.length; index++) {
        const element = apps[index];
        steps.push(
          ...self.createDeploymentStepPromises(element.appName, element.service)
        );
      }

      let currentStep = 0;
      const stepsTexts: string[] = ["Parsing the template"];
      for (let index = 0; index < steps.length; index++) {
        stepsTexts.push(steps[index].stepName);
      }

      const promises: Promise<void>[] = [];

      promises.push(
        new Promise(function(resolve) {
          self.onDeploymentStateChanged(
            Utils.copyObject({
              steps: stepsTexts,
              error: "",
              currentStep: 0
            })
          );
          resolve();
        })
      );

      for (let index = 0; index < steps.length; index++) {
        const element = steps[index];
        promises.push(element.stepPromise);
        promises.push(
          new Promise(function(resolve) {
            currentStep++;
            self.onDeploymentStateChanged(
              Utils.copyObject({
                steps: stepsTexts,
                error: "",
                currentStep
              })
            );
            resolve();
          })
        );
      }

      Promise.all(promises).catch(function(error) {
        self.onDeploymentStateChanged(
          Utils.copyObject({
            steps: stepsTexts,
            error: "Failed: " + error,
            currentStep
          })
        );
      });
    }
  }

  /**
   * Outputs an array which includes all services in order based on their dependencies.
   * The first element is an app without any dependencies. The second element can be an app that depends on the first app.
   */
  createAppsArrayInOrder() {
    const apps: {
      appName: string;
      service: IDockerComposeService;
    }[] = [];

    let numberOfServices = 0;
    const servicesMap = this.template!.dockerCompose.services;
    Object.keys(servicesMap).forEach(function(key) {
      numberOfServices++;
    });

    let itCount = 0;
    while (apps.length < numberOfServices) {
      if (itCount > numberOfServices) {
        // we are stuck in an infinite loop
        return undefined;
      }
      itCount++;

      Object.keys(servicesMap).forEach(function(appName) {
        for (let index = 0; index < apps.length; index++) {
          const element = apps[index];
          if (element.appName === appName) {
            // already added
            return;
          }
        }

        let service = servicesMap[appName];

        const dependsOn = service.depends_on || [];

        for (let index = 0; index < dependsOn.length; index++) {
          const element = dependsOn[index];
          let dependencyAlreadyAdded = false;
          for (let j = 0; j < apps.length; j++) {
            if (element === apps[j].appName) {
              dependencyAlreadyAdded = true;
            }
          }

          if (!dependencyAlreadyAdded) return;
        }

        apps.push({
          appName,
          service
        });
      });
    }

    return apps;
  }

  createDeploymentStepPromises(
    appName: string,
    dockerComposeService: IDockerComposeService
  ): IDeploymentStep[] {
    const promises: IDeploymentStep[] = [];

    // promise to create
    // promise to update
    // promise to deploy

    return promises;
  }
}
