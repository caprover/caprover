const {
  validateIsGitRepository,
  validateDefinitionFile,
  optionIsNotGiven,
  isIpAddress,
  validateAuthentication
} = require("../validationsHandler")
const { printError } = require("../messageHandler")
const { requestLogin } = require("../../lib/login")
const { initMachineFromLocalStorage } = require("../machineUtils")

jest.mock("fs")

jest.mock("../messageHandler", () => {
  return {
    printError: jest.fn()
  }
})

jest.mock("../../api/DeployApi", () => {
  return {
    isAuthTokenValid: jest.fn(() => false) // Simulates it's not authenticated
  }
})

jest.mock("../../lib/login", () => {
  return {
    requestLogin: jest.fn()
  }
})

jest.mock("../machineUtils", () => {
  return {
    initMachineFromLocalStorage: jest.fn()
  }
})

describe("Validations handler", () => {
  it("should printError if not on a git repository", () => {
    validateIsGitRepository()

    expect(printError).toHaveBeenCalledTimes(1)
  })

  it("should printError if there is no captain definition file", () => {
    validateDefinitionFile()

    // 2nd time because file was not found
    // 3rd time because it tried to read from a file and was not valid json
    expect(printError).toHaveBeenCalledTimes(3)
  })

  it("should return false if the option is included", () => {
    const options = {
      branch: "master"
    }
    const result = optionIsNotGiven(options, "branch")

    expect(result).toBe(false)
  })

  it("should return true if the option is not given", () => {
    const options = {
      test: "something"
    }
    const result = optionIsNotGiven(options, "branch")

    expect(result).toBe(true)
  })

  it("should be a valid IP Address", () => {
    const validIpAddress = "192.168.1.1"
    const result = isIpAddress(validIpAddress)

    expect(result).toBe(true)
  })

  it("should be an invalid IP Address", () => {
    const validIpAddress = "192.168.1"
    const result = isIpAddress(validIpAddress)

    expect(result).toBe(false)
  })

  it("should promt the login option and initialize from the machine in localstorage", async () => {
    await validateAuthentication()

    expect(requestLogin).toBeCalledTimes(1)

    expect(initMachineFromLocalStorage).toBeCalledTimes(1)
  })
})
