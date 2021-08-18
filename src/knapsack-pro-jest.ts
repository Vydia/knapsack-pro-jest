#!/usr/bin/env node

const { name: clientName, version: clientVersion } = require('../package.json');

const jest = require('jest');
const { v4: uuidv4 } = require('uuid');

import {
  KnapsackProCore,
  KnapsackProLogger,
  onQueueFailureType,
  onQueueSuccessType,
  TestFile,
} from '@knapsack-pro/core';
import { EnvConfig } from './env-config';
import { TestFilesFinder } from './test-files-finder';
import { JestCLI } from './jest-cli';

const jestCLIOptions = JestCLI.argvToOptions();
const knapsackProLogger = new KnapsackProLogger();
knapsackProLogger.debug(
  `Jest CLI options:\n${KnapsackProLogger.objectInspect(jestCLIOptions)}`
);

EnvConfig.loadEnvironmentVariables();

const projectPath = process.cwd();
const allTestFiles: TestFile[] = await TestFilesFinder.allTestFiles();
const knapsackPro = new KnapsackProCore(
  clientName,
  clientVersion,
  allTestFiles
);

const onSuccess: onQueueSuccessType = async (queueTestFiles: TestFile[]) => {
  const testFilePaths: string[] = queueTestFiles.map(
    (testFile: TestFile) => testFile.path
  );

  let isOuterTestSuiteGreen = true

  const jestCLICoverage = EnvConfig.coverageDirectory
    ? { coverageDirectory: `${EnvConfig.coverageDirectory}/${uuidv4()}` }
    : {};

  const allResults = (await Promise.all(testFilePaths.map(async (complexTestFilePath) => {
    const [testFilePath, testName] = complexTestFilePath.split('|', 2)
    const {
      results: { success: isTestSuiteGreen, testResults },
    } = await jest.runCLI(
      {
        ...jestCLIOptions,
        ...jestCLICoverage,
        runTestsByPath: true,
        testNamePattern: testName, // TODO: Regex start and end pattern?
        _: testFilePath,
      },
      [projectPath]
    );

    if (!isTestSuiteGreen) isOuterTestSuiteGreen = false

    const recordedTestFiles: TestFile[] = testResults.map(
      ({
        testFilePath: _,
        perfStats: { start, end },
      }: {
        testFilePath: string;
        perfStats: { start: number; end: number };
      }) => {
        // We only run jest cli once per testNamePattern so I think we don't need to parse this anymore.
        // const path =
        //   process.platform === 'win32'
        //     ? testFilePath.replace(`${projectPath}\\`, '').replace(/\\/g, '/')
        //     : testFilePath.replace(`${projectPath}/`, '');
        const timeExecutionMiliseconds = end - start;
        const timeExecution =
          timeExecutionMiliseconds > 0 ? timeExecutionMiliseconds / 1000 : 0.0;

        return {
          path: complexTestFilePath,
          time_execution: timeExecution,
        };
      }
    );

    return recordedTestFiles
  }))).flat()

  return {
    recordedTestFiles: allResults,
    isTestSuiteGreen: isOuterTestSuiteGreen,
  };
};

// we do nothing when error so pass noop
const onError: onQueueFailureType = (error: any) => {};

knapsackPro.runQueueMode(onSuccess, onError);
