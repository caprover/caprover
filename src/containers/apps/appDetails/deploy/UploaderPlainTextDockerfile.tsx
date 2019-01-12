import UploaderPlainTextCaptainDefinition from "./UploaderPlainTextCaptainDefinition";
import { ICaptainDefinition } from "../../../../models/ICaptainDefinition";

export default class UploaderPlainTextDockerfile extends UploaderPlainTextCaptainDefinition {
  protected getPlaceHolderValue() {
    return `# Derived from official mysql image (our base image)
FROM mysql:5.7
# Add a database
ENV MYSQL_DATABASE company`;
  }

  protected convertDataToCaptainDefinition(userEnteredValue: string) {
    const capDefinition: ICaptainDefinition = {
      schemaVersion: 2,
      dockerfileLines: userEnteredValue.trim().split("\n")
    };

    return JSON.stringify(capDefinition);
  }
}
