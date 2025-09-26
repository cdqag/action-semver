import { createJsWithTsEsmPreset } from "ts-jest";

const tsJestTransformCfg = createJsWithTsEsmPreset().transform;

export default {
    extensionsToTreatAsEsm: ['.ts', '.tsx'],
    transform: {
        ...tsJestTransformCfg,
    },
    testMatch: [
        "**/__tests__/**/*.(test|spec).(ts|js)",
        "**/*.(test|spec).(ts|js)"
    ],
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/**/*.d.ts",
        "!src/**/__tests__/**",
        "!src/model/index.ts"
    ],
    coverageDirectory: "coverage",
    coverageReporters: ["text", "lcov", "html"],
    testEnvironment: "node"
};
