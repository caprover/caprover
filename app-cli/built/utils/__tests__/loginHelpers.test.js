var _a = require("../loginHelpers"), cleanUpUrl = _a.cleanUpUrl, findDefaultCaptainName = _a.findDefaultCaptainName, getCaptainFullName = _a.getCaptainFullName;
jest.mock("../../helpers/MachineHelper", function () {
    return {
        machines: [
            {
                baseUrl: "https://captain.myfirstmachine.com",
                name: "machine-01",
                authToken: "token1"
            },
            {
                baseUrl: "https://captain.mysecondmachine.com",
                name: "machine-02",
                authToken: "token2"
            }
        ]
    };
});
describe("Login helpers", function () {
    it("should clean a url", function () {
        var mockUrl = "https://www.google.com";
        var expectedResult = "www.google.com";
        var result = cleanUpUrl(mockUrl);
        expect(result).toBe(expectedResult);
    });
    it("should get a captain machine name", function () {
        var result = getCaptainFullName(1);
        var expectedResult = "captain-01";
        expect(result).toBe(expectedResult);
    });
    it("should find an unused name for a possible new captain machine", function () {
        // If machines are 2, then it should be with suffix 03
        var result = findDefaultCaptainName();
        var expectedResult = "captain-03";
        expect(result).toBe(expectedResult);
    });
});
