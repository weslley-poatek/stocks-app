const ReactNativeEnvironment = require('jest-expo/src/preset/nativeEnvironment');

// jest-expo replaces the global fetch with Expo's native-backed one, which is a stub in Jest and
// can't be intercepted by msw. Keep Node's own fetch (and its Request/Response/Headers) aside so
// jest.setup.js can put it back.
class Environment extends ReactNativeEnvironment {
  constructor(config, context) {
    super(config, context);
    const g = this.global;
    g.__nodeFetchGlobals = {
      fetch: g.fetch,
      Headers: g.Headers,
      Request: g.Request,
      Response: g.Response,
    };
  }
}

module.exports = Environment;
module.exports.TestEnvironment = Environment;
