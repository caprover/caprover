import { IHashMapGeneric } from "../../../models/IHashMapGeneric";
import {
  IOneClickTemplate,
  IDockerComposeService
} from "./OneClickAppConfigPage";
import Utils from "../../../utils/Utils";
import OneClickAppDeploymentHelper from "./OneClickAppDeploymentHelper";

interface IDeploymentStep {
  stepName: string;
  stepPromise: () => Promise<void>;
}

export interface IDeploymentState {
  steps: string[];
  error: string;
  successMessage?: string;
  currentStep: number;
}

export default class OneClickAppDeployManager {
  private deploymentHelper: OneClickAppDeploymentHelper = new OneClickAppDeploymentHelper();
  private template: IOneClickTemplate | undefined;
  constructor(
    private onDeploymentStateChanged: (
      deploymentState: IDeploymentState
    ) => void
  ) {
    //
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

      const stepsTexts: string[] = ["Parsing the template"];
      for (let index = 0; index < steps.length; index++) {
        stepsTexts.push(steps[index].stepName);
      }

      let currentStep = 0;
      const onNextStepPromiseCreator = function() {
        return new Promise<void>(function(resolve) {
          currentStep++;
          self.onDeploymentStateChanged(
            Utils.copyObject({
              steps: stepsTexts,
              error: "",
              currentStep,
              successMessage:
                currentStep >= stepsTexts.length
                  ? self.template!.instructions.end
                  : undefined
            })
          );
          resolve();
        });
      };

      let promise = onNextStepPromiseCreator();

      for (let index = 0; index < steps.length; index++) {
        const element = steps[index];
        promise = promise
          .then(element.stepPromise)
          .then(onNextStepPromiseCreator);
      }

      promise.catch(function(error) {
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
    const self = this;

    promises.push({
      stepName: `Registering ${appName}`,
      stepPromise: function() {
        return self.deploymentHelper.createRegisterPromise(
          appName,
          dockerComposeService
        );
      }
    });

    promises.push({
      stepName: `Configuring ${appName} (volumes, ports, environmental variables)`,
      stepPromise: function() {
        return self.deploymentHelper.createConfigurationPromise(
          appName,
          dockerComposeService
        );
      }
    });

    promises.push({
      stepName: `Deploying ${appName} (might take up to a minute)`,
      stepPromise: function() {
        return self.deploymentHelper.createDeploymentPromise(
          appName,
          dockerComposeService
        );
      }
    });

    return promises;
  }
}
