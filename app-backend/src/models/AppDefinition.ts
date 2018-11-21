interface IAllAppDefinitions {
    [appId: string]: IAppDefinition;
}

interface IAppPushWebhook {
    repoInfo: {
        repo: string
        branch: string
        user: string
        password: string
    };
}

interface IAppPushWebhookAsSaved {
    tokenVersion: string;
    /*repoInfo: {
        repoAddress: string
        branch: string
        user: string
        passwordEncrypted: string
    };*/
    repoInfo: string;
    pushWebhookToken: string;
}


interface IAppEnvVar {
    key: string;
    value: string;
}

interface IAppVolume {
    containerPath: string;
    volumeName: string;
    hostPath: string;
    type: string;
}

interface IAppPort {
    containerPort: number;
    hostPort: number;
    // type: string;
}

class IAppDefinition {
    public deployedVersion: number;
    public notExposeAsWebApp: boolean;
    public hasPersistentData: boolean;
    public hasDefaultSubDomainSsl: boolean;

    public forceSsl: boolean;
    public nodeId: string;
    public instanceCount: number;
    public preDeployFunction: string;
    public customNginxConfig: string;
    public networks: string[];
    public customDomain: {
        publicDomain: string
        hasSsl: boolean
    }[];
    public appPushWebhook: IAppPushWebhookAsSaved;

    public ports: IAppPort[];


    public volumes: IAppVolume[];
    public envVars: IAppEnvVar[];

    public versions: {
        version: number,
        timeStamp: string,
       /// imageName: string,
        gitHash: string|undefined,
    }[];
}
