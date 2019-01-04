const { initMachineFromLocalStorage, saveMachineToLocalStorage } = require("../machineUtils");
const DeployApi = require("../../api/DeployApi");
const MachineHelper = require("../../helpers/MachineHelper");
const mockUpdatedApps = [
    {
        cwd: process.cwd(),
        appName: "captain-node-app-new-name",
        branchToPush: "master",
        machineToDeploy: {
            baseUrl: "https://int-test.captainduckduck.com",
            name: "int-test",
            authToken: "token1"
        }
    }
];
jest.mock("../../helpers/MachineHelper", () => {
    return {
        apps: [
            {
                cwd: process.cwd(),
                appName: "captain-node-app",
                branchToPush: "master",
                machineToDeploy: {
                    baseUrl: "https://int-test.captainduckduck.com",
                    name: "int-test",
                    authToken: "token1"
                }
            }
        ],
        setApps: jest.fn()
    };
});
jest.mock("../../api/DeployApi", () => {
    return {
        setMachineToDeploy: jest.fn(),
        setAppName: jest.fn(),
        setBranchToPush: jest.fn(),
        appName: "captain-node-app-new-name",
        branchToPush: "master",
        machineToDeploy: {
            baseUrl: "https://int-test.captainduckduck.com",
            name: "int-test",
            authToken: "token1"
        }
    };
});
describe("Machine utils", () => {
    it("should init machine from localStorage", () => {
        initMachineFromLocalStorage();
        expect(DeployApi.setMachineToDeploy).toHaveBeenCalledTimes(1);
        expect(DeployApi.setAppName).toHaveBeenCalledTimes(1);
        expect(DeployApi.setBranchToPush).toHaveBeenCalledTimes(1);
    });
    it("should update an app from localstorage", () => {
        saveMachineToLocalStorage();
        const updatedApps = mockUpdatedApps;
        expect(MachineHelper.setApps).toBeCalledWith(updatedApps);
    });
});
//# sourceMappingURL=machineUtils.test.js.map