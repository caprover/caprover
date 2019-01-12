import UploaderPlainTextBase from "./UploaderPlainTextBase";

export default class UploaderPlainTextCaptainDefinition extends UploaderPlainTextBase {
  protected getPlaceHolderValue() {
    return `{
    "schemaVersion" :2 ,
    "imageName" : "mysql:5.7
}`;
  }

  protected convertDataToCaptainDefinition(userEnteredValue: string) {
    return userEnteredValue.trim();
  }
}
