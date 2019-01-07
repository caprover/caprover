#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const inquirer = require("inquirer");
const StdOutUtil_1 = require("../utils/StdOutUtil");
const CliHelper_1 = require("../utils/CliHelper");
function generateQuestions() {
    const listOfMachines = CliHelper_1.default.get().getMachinesAsOptions();
    return [
        {
            type: 'list',
            name: 'captainNameToLogout',
            message: 'Select the Captain Machine you want to logout from:',
            choices: listOfMachines
        },
        {
            type: 'confirm',
            name: 'confirmedToLogout',
            message: 'Are you sure you want to logout from this Captain machine?',
            default: false,
            when: (answers) => answers.captainNameToLogout
        }
    ];
}
function logout() {
    return __awaiter(this, void 0, void 0, function* () {
        const questions = generateQuestions();
        StdOutUtil_1.default.printMessage('Logout from a Captain Machine and clear auth info');
        const answers = yield inquirer.prompt(questions);
        const { captainNameToLogout, confirmedToLogout } = answers;
        if (!captainNameToLogout || !confirmedToLogout) {
            StdOutUtil_1.default.printMessage('\nOperation cancelled by the user...\n');
            return;
        }
        CliHelper_1.default.get().logoutMachine(captainNameToLogout);
    });
}
exports.default = logout;
//# sourceMappingURL=logout.js.map