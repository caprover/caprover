const {
  cleanUpUrl,
  findDefaultCaptainName,
  getCaptainFullName
} = require("../loginHelpers")

jest.mock("../../helpers/MachineHelper", () => {
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
  }
})

describe("Login helpers", () => {
  it("should clean a url", () => {
    const mockUrl = "https://www.google.com"
    const expectedResult = "www.google.com"
    const result = cleanUpUrl(mockUrl)

    expect(result).toBe(expectedResult)
  })

  it("should get a captain machine name", () => {
    const result = getCaptainFullName(1)
    const expectedResult = "captain-01"

    expect(result).toBe(expectedResult)
  })

  it("should find an unused name for a possible new captain machine", () => {
    // If machines are 2, then it should be with suffix 03
    const result = findDefaultCaptainName()
    const expectedResult = "captain-03"

    expect(result).toBe(expectedResult)
  })
})
