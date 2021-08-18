// copied mostly from jest-jasmine
// this is used by TDD-cli to parse test names out and that's it
// it's part of a hack to get test names from a test file
/* eslint-disable no-param-reassign */

// TODO: Tighten lint & flow

import { join, noop } from 'lodash-es';

function jasmine2( // eslint-disable-line max-params
  _globalConfig,
  _config,
  environment,
  runtime,
  testPath,
) {
  // add stubs
  environment.global.jasmine = {
    getEnv: () => ({
      addReporter: noop,
    }),
  };

  const testNames = [];

  const descNamespace = [];
  const withDescNamespace = (name, inner) => {
    descNamespace.push(name);
    inner();
    descNamespace.pop();
  };

  environment.global.describe = (name, inner) => withDescNamespace(name, inner);
  environment.global.it = (name) => {
    testNames.push(join([...descNamespace, name], ' '));
    return Promise.resolve();
  };
  environment.global.beforeEach = () => Promise.resolve();
  environment.global.beforeAll = () => Promise.resolve();
  environment.global.afterEach = () => Promise.resolve();
  environment.global.afterAll = () => Promise.resolve();

  environment.global.test = environment.global.it;
  environment.global.it.only = environment.global.fit;
  environment.global.it.skip = environment.global.xit;
  environment.global.xtest = environment.global.xit;
  environment.global.describe.skip = environment.global.xdescribe;
  environment.global.describe.only = environment.global.fdescribe;

  runtime.requireModule(testPath);

  const results = {
    numFailedTestSuites: 0,
    numFailedTests: 0,
    numPassedTestSuites: 0,
    numPassedTests: 0,
    numPendingTestSuites: 0,
    numPendingTests: 0,
    numRuntimeErrorTestSuites: 0,
    numTotalTestSuites: 0,
    numTotalTests: 0,
    snapshot: {
      added: 0,
      didUpdate: false,
      failure: false,
      filesAdded: 0,
      filesRemoved: 0,
      filesUnmatched: 0,
      filesUpdated: 0,
      matched: 0,
      total: 0,
      unchecked: 0,
      unmatched: 0,
      updated: 0,
    },

    startTime: Date.now(),
    success: false,
    testResults: [],
    wasInterrupted: true,
  };
  results.testNames = testNames;

  return Promise.resolve(results);
}

module.exports = jasmine2;
