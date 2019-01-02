import { IHashMapGeneric } from "./IHashMapGeneric";

export interface IOneClickAppIdentifier {
  name: string;
  download_url: string;
}

export interface IOneClickVariable {
  id: string;
  label: string;
  defaultValue?: string;
  validRegex?: string;
  description?: string;
}

export interface IDockerComposeService {
  image?: string;
  dockerFileLines?: string[]; // This is our property, not DockerCompose. We use this instead of image if we need to extend the image.
  volumes?: string[];
  ports?: string[];
  environment?: IHashMapGeneric<string>;
  depends_on?: string[];
}

export interface IOneClickTemplate {
  captainVersion: number;
  dockerCompose: {
    version: string;
    services: IHashMapGeneric<IDockerComposeService>;
  };
  instructions: {
    start: string;
    end: string;
  };
  variables: IOneClickVariable[];
}