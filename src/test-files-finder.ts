import glob = require('glob');
import minimatch = require('minimatch');

import { KnapsackProLogger, TestFile } from '@knapsack-pro/core';
import { EnvConfig } from './env-config';
import { readConfig } from 'jest-config'
import Runtime from 'jest-runtime'
import { createWriteStream } from 'fs-extra'
import { Console, setGlobal } from 'jest-util'
import path from 'path'

const root = process.cwd()
const knapsackProSrcRoot = __dirname
const projectRoot: () => string = () => root
const testingRoot: () => string = () => root

/*
Gets names of each test that can run within a file by loading up Jest and using a fake test runner.
This 'runs' the test with no results, with the goal of just extracting test names.
Another approach could be to parse the test file using jscodeshift but that wouldn't take dynamic test names into account.
*/
const getTestNames = async (testFile: string): Promise<string[]> => {
  // most of this was borrowed from node_modules/jest-runtime/build/cli/index.js
  const options = await readConfig({} as any, projectRoot())
  const globalConfig = options.globalConfig
  // jest 20 used options.config but 22 used options.projectConfig
  const config = {
    ...options.projectConfig,
    automock: false,
    unmockedModulePathPatterns: null as any,
  }

  // testEnvironment is currently node_modules/jest-environment-node/build/index.js',
  const Environment = require(config.testEnvironment)

  const hasteMap = await Runtime.createContext(config, { watchman: false, maxWorkers: 1 })

  const environment = new Environment(config)

  const jestOutputPath = `/tmp/tdd-jest-parse-${Date.now()}.log`
  const outStream = createWriteStream(jestOutputPath)

  setGlobal(environment.global, 'console', new Console(outStream, outStream))
  environment.global.jestProjectConfig = config
  environment.global.jestGlobalConfig = globalConfig

  const jestRuntime = new Runtime(config, environment, hasteMap.resolver)
  // this bit loads up the jasmine test runner. since we aren't testing a single file, I put a placeholder file. Another approach
  // could be something like environment.global.jasmine = runtime.requireModule(config.testRunner) but that would be incomplete, missing things like 'describe'
  const testRunner = path.join(knapsackProSrcRoot, 'jest-testname-extractor-runner.js')
  const testFramework = jestRuntime.requireModule(testRunner) as Function
  process.env.DISABLE_DESCRIBE_FOR_ALL_LANGUAGES = '1'
  const results = await testFramework(globalConfig, config, environment, jestRuntime, testFile)
  delete process.env.DISABLE_DESCRIBE_FOR_ALL_LANGUAGES
  return [...new Set(results.testNames) as any] // some tests had the same it block in different describe blocks so filter out duplicates
}

export class TestFilesFinder {
  public static async allTestFiles(): Promise<TestFile[]> {
    const testFiles = (await Promise.all(glob
      .sync(EnvConfig.testFilePattern)
      .filter((testFilePath: string) => {
        if (EnvConfig.testFileExcludePattern) {
          return !minimatch(testFilePath, EnvConfig.testFileExcludePattern, {
            matchBase: true,
          });
        }
        return true;
      })
      .filter((testFilePath: string) => {
        // ignore test file paths inside node_modules because it's default Jest behavior
        // https://jestjs.io/docs/en/22.2/configuration#testpathignorepatterns-array-string
        return !testFilePath.match(/node_modules/);
      })
      .map(async (testFilePath: string) => (await getTestNames(testFilePath)).map((testName) => ({ path: `${testFilePath}|${testName}` }))))
    ).flat();

    if (testFiles.length === 0) {
      const knapsackProLogger = new KnapsackProLogger();

      const errorMessage =
        // tslint:disable-next-line: max-line-length
        'Test files cannot be found.\nPlease set KNAPSACK_PRO_TEST_FILE_PATTERN matching your test directory structure.\nLearn more: https://knapsackpro.com/faq/question/how-to-run-tests-only-from-specific-directory-in-jest';

      knapsackProLogger.error(errorMessage);
      throw errorMessage;
    }

    return testFiles;
  }
}
