var _a = require("../machineUtils"), initMachineFromLocalStorage = _a.initMachineFromLocalStorage, saveMachineToLocalStorage = _a.saveMachineToLocalStorage;
var DeployApi = require("../../api/DeployApi");
var MachineHelper = require("../../helpers/MachineHelper");
var mockUpdatedApps = [
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
jest.mock("../../helpers/MachineHelper", function () {
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
jest.mock("../../api/DeployApi", function () {
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
describe("Machine utils", function () {
    it("should init machine from localStorage", function () {
        initMachineFromLocalStorage();
        expect(DeployApi.setMachineToDeploy).toHaveBeenCalledTimes(1);
        expect(DeployApi.setAppName).toHaveBeenCalledTimes(1);
        expect(DeployApi.setBranchToPush).toHaveBeenCalledTimes(1);
    });
    it("should update an app from localstorage", function () {
        saveMachineToLocalStorage();
        var updatedApps = mockUpdatedApps;
        expect(MachineHelper.setApps).toBeCalledWith(updatedApps);
    });
});
