/**
 * availity-angular v0.2.0 -- February-16
 * Copyright 2015 Availity, LLC 
 */

// Source: /lib/core/index.js


(function(root) {

  'use strict';

  var availity = root.availity || {};
  availity.VERSION = 'v0.0.1';
  availity.MODULE = 'availity';
  availity.core = angular.module(availity.MODULE, ['ng']);

  var originalModule = angular.module;
  var modules = [];

  angular.module = function(name, deps) {

    if(deps && _.indexOf(modules, name) !== -1 ) {
      throw new Error('redefining module: ' + name);
    }
    modules.push(name);
    if(window.console && window.console.log) {
      window.console.log(modules);
    }
    return originalModule(name, deps);
  };

  root.availity = availity;

  if(typeof module !== 'undefined' && module.exports) {
    module.exports = availity;
  }

})(window);


// Source: /lib/core/utils/strings.js
(function(root) {

  'use strict';

  var availity = root.availity;

  // https://github.com/epeli/underscore.string/blob/cebddf40cf2e10f0e9b596d9654edd0a1cfefc15/helper/makeString.js
  availity._stringify = function(object) {
    if(object === null) {
      return '';
    }
    return '' + object;
  };

  // https://github.com/epeli/underscore.string/blob/cebddf40cf2e10f0e9b596d9654edd0a1cfefc15/isBlank.js
  availity.isBlank = function(str) {
    availity._stringify(str);
  };

})(window);

// Source: /lib/core/utils/uuid.js
(function(root) {

  'use strict';

  var availity = root.availity;

  var uid = ['0', '0', '0'];

  availity.uuid = function(prefix) {
    var index = uid.length;
    var digit;

    while(index) {
      index--;
      digit = uid[index].charCodeAt(0);
      if(digit === 57 /*'9'*/) {
        uid[index] = 'A';
        return prefix ? prefix + uid.join('') : uid.join('');
      }
      if(digit === 90  /*'Z'*/) {
        uid[index] = '0';
      } else {
        uid[index] = String.fromCharCode(digit + 1);
        return prefix ? prefix + uid.join('') : uid.join('');
      }
    }
    uid.unshift('0');
    return prefix ? prefix + uid.join('') : uid.join('');
  };

})(window);

// Source: /lib/core/utils/urls.js
(function(root) {

  'use strict';

  var availity = root.availity;

  availity.REGEX_API_URL = /^.*?api.availity.com(.*)$/;

  availity.getRelativeUrl = function(url) {
    var result = url.match(availity.REGEX_API_URL);
    if(result && result[1]) {
      return '/api' + result[1];
    }

    return url;
  };

})(window);

// Source: /lib/core/polling/polling.js
(function(root) {
  'use strict';

  var availity = root.availity;

  availity.core.constant('AV_POLLING', {
    INTERVAL: 1000, // delay in ms before retrying an async request
    MAX_ELAPSED_TIME: 5000, // max time in ms before polling stops and rejects original request
    MAX_RETRY: 30, // # of times the request will be tried
    DECAY: 1.2, // % the polling interval decays after every retry
    // maximum time polling is allowed before rejecting the request
    EVENTS: {
      MAX_RETRY: 'polling:max:retry'
    },
    REGEX_URL: /^.*?api.availity.com(.*)$/ // capture the relative url from API
  });

  var PollingServiceFactory = function($rootScope, $q, $injector, $timeout, $log, AV_POLLING) {

    var AvPollingService = function() {
      this.pendingRequests = []; // stores all request for polling
    };

    var proto = AvPollingService.prototype;

    proto.response = function(response) {

      if(this.isAsyncResponse(response)) {
        return this.onAsyncReponse(response);
      }

      return response || $q.when(response);
    };

    proto.setDefaults = function(config) {

      var defaultOptions = {
        pollingInterval: AV_POLLING.INTERVAL,
        pollingDecay: AV_POLLING.DECAY,
        pollingMaxInterval: AV_POLLING.MAX_ELAPSED_TIME,
        pollingRetryCount: 0,
        pollingStartTime: new Date().getTime()
      };

      config = _.extend(defaultOptions, config);
    };

    proto.responseError = function(response) {
      // Return the promise rejection
      return $q.reject(response);
    };

    /**
     * API layer return a link with a polling url for
     * async responses.
     *
     * @param  {Object}  response ajax response
     * @return {Boolean} true if response has status of 202 (accepted) and location param in header with uri+session link
     */
    proto.isAsyncResponse = function(response) {

      return response &&
        response.config &&
        response.config.api &&
        response.status &&
        response.status === 202 &&
        angular.isFunction(response.headers) && !availity.isBlank(response.headers('location'));
    };

    proto.onAsyncReponse = function(response) {

      this.setDefaults(response.config);

      var deferred = $q.defer();

      this.queueRequest(deferred, response);

      // [rm3]: Can't call notify before you return promise object?
      $timeout(function() {
        // Notify deferred listeners with the original server response
        deferred.notify(response);
      });

      return deferred.promise;
    };

    proto.getUrl = function(url) {

      var result = url.match(AV_POLLING.REGEX_URL);
      if(result && result[1]) {
        return '/api' + result[1];
      }

      return url;
    };

    proto.queueRequest = function(deferred, response) {

      var self = this;
      // server replies with poll href so set the url into config
      var _url = availity.getRelativeUrl(response.headers('location'));
      var _config = response.config;

      var config = {
        method: 'GET',
        api: true,
        pollingInterval: _config.pollingInterval,
        pollingMaxRetry: _config.pollingMaxRetry,
        pollingMaxInterval: _config.pollingMaxInterval,
        pollingStartTime: _config.pollingStartTime,
        _pollingDecay: _config._pollingDecay,
        pollingRetryCount: _config.pollingRetryCount,
        pollingDecay: _config.pollingDecay,
        url: _url, /* set the url from the server response */
        cache: false
      };

      var request = {
        id: availity.uuid('request-'),
        config: config,
        deferred: deferred
      };

      var timeout = this.getPollingTimeout(config);

      // each async request should run on its own timer
      var timer = $timeout(function() {
        self.retryRequest(request.id);
      }, timeout);

      request.timer = timer;

      // add the async request to the queue
      this.pushRequest(request);

    };

    proto.popRequest = function(id) {

      var index = null;
      var request = null;

      for(var i = 0; i < this.pendingRequests.length; i++) {
        if(this.pendingRequests[i].id === id) {
          index = i;
          break;
        }
      }

      request = this.pendingRequests[index];
      this.pendingRequests.splice(index, 1);

      return request;
    };

    proto.pushRequest = function(request) {
      this.pendingRequests.push(request);
    };

    proto.getPollingTimeout = function(config) {
      return config.pollingDecay * config.pollingMaxInterval;
    };

    proto.isPollingMaxTimeout = function(config) {
      var now = new Date().getTime();
      var elaspedTime = now - config.pollingStartTime;
      var isElapsed = elaspedTime > config.pollingMaxInterval;
      return isElapsed;
    },

      proto.isMaxRetried = function(config) {
        return config.pollingRetryCount >= AV_POLLING.MAX_RETRY;
      };

    proto.isPollable = function(config) {
      var _isTimeout = this.isPollingMaxTimeout(config);
      var _isMax = this.isMaxRetried(config);

      return _isTimeout || _isMax ? false : true;

    };

    proto.retryRequest = function(id) {

      var self = this;
      var request = this.popRequest(id);
      $timeout.cancel(request.timer);

      var config = request.config;

      var deferred = request.deferred;

      if(!this.isPollable(config)) {
        $log.info('Rejecting pollable response due to timeout constraint');
        return deferred.reject(request);
      }

      // increment counters and polling timeouts
      this.increment(config);

      function successCallback(response) {
        if(self.isAsyncResponse(response)) {
          deferred.notify(response);
          self.queueRequest(request.deferred, response);
        } else {
          deferred.resolve(response);
        }
      }

      function errorCallback(response) {
        deferred.reject(response);
      }

      // Silly circular dependency trick
      var $http = $injector.get('$http');

      $http(config).then(successCallback, errorCallback);

    };

    proto.increment = function(config) {
      this.incrementCounter(config);
      this.incrementDecay(config);
    };

    proto.incrementDecay = function(config) {
      if(!config._pollingDecay) {
        // store the original decay param
        config._pollingDecay = config.pollingDecay;
      }
      config.pollingDecay *= config._pollingDecay;
    };

    proto.incrementCounter = function(config) {
      config.pollingRetryCount++;
    };

    proto.clearRequests = function() {
      angular.forEach(this.pendingRequests, function(request) {
        $timeout.cancel(request.timer);
      });
      this.pendingRequests = [];
    };

    return new AvPollingService();

  };

  availity.core.factory('avPollingService', PollingServiceFactory);

})(window);

// Source: /lib/core/api/api-factory.js
(function(root) {

  'use strict';

  var availity = root.availity;

  var defaultOptions = {
    // pre-prend the url with a value like `/public` so we can build urls like `public/api/v1/*`
    prefix: '',
    // default base url for endpoints
    path: '/api',
    // url to resource endpoint like `coverages` or `payers`
    url: null,
    // defaults to version 1
    version: '/v1',
    // governance level `/internal`
    level: '',
    // post-pend the url with `.json`, `.txt` or `.xml`
    suffix: '',
    // cache all request by default
    cache: true,
    // flag used to enable behaviors around the Availity Rest API
    api: true,
    // # of times the polling service has tried to get a response
    pollingRetryCount: 0,
    // in ms
    pollingInterval: 1000,
    // % the polling interval decays after every retry
    pollingDecay: 1.2,
    // maximum time polling is allowed before rejecting the request
    pollingMaxInterval: 30000

  };

  // Factory that creates ApiResourcess
  var ApiResourcesFactory = function($http, $q, avPollingService) {

    var AvApiResource = function(options) {

      if(!options) {
        throw new Error('[options] cannot be null or undefined');
      }

      // if string the assume url is being passed in
      if(angular.isString(options)) {
        options = options.charAt(0) === '/' ? options : '/' + options;
        options = angular.extend({}, {url: options});
      }

      if(!options.url) {
        throw new Error('[url] cannot be null');
      }

      // get the default options and merge into this instance
      this.options = angular.extend({}, defaultOptions, (options || {}));
    };

    // Alias the prototype
    var proto = AvApiResource.prototype;

    proto._config = function(config) {
      return angular.extend({}, this.options, (config || {}));
    },

      proto._getUrl = function(id) {
        if(this.options.api) {
          return this._getApiUrl(id);
        }

        return this.options.url;
      };

    proto._createResponse = function(data, status, headers, config) {
      return {
        data: data,
        status: status,
        headers: headers,
        config: config
      };
    };

    proto._request = function(config, afterCallback) {

      var self = this;
      var defer = $q.defer();

      $http(config)
        .success(function(data, status, headers, _config) {

          var _response = {
            data: data,
            status: status,
            headers: headers,
            config: _config
          };

          // handle the async response if applicable
          var _promise = $q.when(avPollingService.response(_response));
          // notify the promise listener of the original response
          defer.notify(_response);

          // handle the polling service promise
          _promise.then(
            function(successResponse) {

              // if service has a callback then call it
              // var response = self._createResponse(data, status, headers, _config);
              if(afterCallback) {
                successResponse = afterCallback.call(self, successResponse);
              }
              defer.resolve(successResponse);
            }, function(errorResponse) {
              defer.reject(errorResponse);
            }, function(notifyResponse) {
              defer.notify(notifyResponse);
            });

        })
        .error(function(data, status, headers, _config) {
          var response = self._createResponse(data, status, headers, _config);
          defer.reject(response);
        });

      var promise = defer.promise;

      // recreate the success callback ala $http
      promise.success = function(fn) {
        promise.then(function(response) {
          fn(response.data, response.status, response.headers, response.config);
        });
        return promise;
      };

      // recreate the error callback ala $http
      promise.error = function(fn) {
        promise.then(null, function(response) {
          fn(response.data, response.status, response.headers, config);
        });
        return promise;
      };

      promise.always = promise['finally'];

      return promise;
    };

    proto._getApiUrl = function(id) {
      id = id ? '/' + id : '';
      return this.options.prefix + this.options.path + this.options.level + this.options.version + this.options.url + id + this.options.suffix;
    };

    proto.all = function(config) {

      config = this._config(config);
      config.method = 'GET';
      config.url = this._getUrl();

      return this._request(config, this.afterAll);

    };

    // alias `all` since it was a bad name to being with
    proto.query = proto.all;

    proto.create = function(data, config) {

      if(!data) {
        throw new Error('called method without [data]');
      }

      if(this.beforeCreate) {
        this.beforeCreate(this, data);
      }

      config = this._config(config);
      config.method = 'POST';
      config.url = this._getUrl();
      config.data = data;

      return this._request(config, this.afterCreate);

    },


      proto.get = function(id, config) {

        if(!id) {
          throw new Error('called method without [id]');
        }

        config = this._config(config);
        config.method = 'GET';
        config.url = this._getUrl(id);

        return this._request(config, this.afterGet);

      };

    proto.query = function(params) {

      if(!params) {
        throw new Error('called query without parameters');
      }

      var config = this._config(config);
      config.params = params;
      config.method = 'GET';
      config.url = this._getUrl();

      return this._request(config, this.afterGet);

    };

    proto.update = function(id, data, config) {
      if(!id || !data) {
        throw new Error('called method without [id] or [data]');
      }

      config = this._config(config);
      config.method = 'PUT';
      config.url = this._getUrl(id);
      config.data = data;

      if(this.beforeUpdate) {
        data = this.beforeUpdate(data);
      }

      return this._request(config, this.beforeUpdate, this.afterUpdate);


    };

    proto.updateWithoutId = function(data, config) {
      if(!data) {
        throw new Error('called method without [data]');
      }

      config = this._config(config);
      config.method = 'PUT';
      config.url = this._getUrl();
      config.data = data;

      if(this.beforeUpdate) {
        data = this.beforeUpdate(data);
      }

      return this._request(config, this.beforeUpdate, this.afterUpdate);
    };

    proto.remove = function(id, config) {
      if(!id) {
        throw new Error('called method without [id]');
      }

      config = this._config(config);
      config.method = 'DELETE';
      config.url = this._getUrl(id);

      return this._request(config, this.afterRemove);
    };

    proto.beforeCreate = null;
    proto.afterCreate = null;
    proto.afterAll = null;
    proto.afterGet = null;
    proto.beforeUpdate = null;
    proto.afterUpdate = null;
    proto.afterRemove = null;

    return AvApiResource;

  };

  availity.core.factory('AvApiResource', ApiResourcesFactory);

})(window);

// Source: /lib/core/api/api-users.js
(function(root) {
  'use strict';

  var availity = root.availity;

  var UserServiceFactory = function(AvApiResource, $q) {

    var AvUsersResource = function() {
      this.user = null;
      AvApiResource.call(this, 'users');
    };

    angular.extend(AvUsersResource.prototype, AvApiResource.prototype, {

      afterGet: function(response) {
        var user = response.data.user ? response.data.user : response.data;
        this.user = user;
        return user;
      },

      me: function() {

        if(this.user) {
          return $q.when(this.user);
        }

        return this.get('me');
      }

    });

    return new AvUsersResource();

  };

  availity.core.factory('avUsersResource', UserServiceFactory);

})(window);

// Source: /lib/core/api/api-permissions.js
(function(root) {

  'use strict';

  var PermissionFactory = function(AvApiResource) {

    var AvPermissionsResource = function() {
      AvApiResource.call(this, {version: '/v1', url: '/permissions'});
    };

    angular.extend(AvPermissionsResource.prototype, AvApiResource.prototype, {

      afterAll: function(response) {
        return response.data.permissions ? response.data.permissions : response.data;
      },

      getPermissions: function(permissionId) {
        return this.all({params: {permissionId: permissionId}}).then(function(response) {
          var result = response.data.permissions ? response.data.permissions : [];
          return result;
        });
      }

    });
    return new AvPermissionsResource();
  };


  root.availity.core.factory('avPermissionsResource', PermissionFactory);

})(window);

// Source: /lib/core/api/api-coverages.js
(function(root) {

  'use strict';

  var availity = root.availity;

  availity.core.factory('avCoveragesResource', function(AvApiResource) {
    return new AvApiResource({version: '/v1', url: '/configurations', cache: false});
  });

})(window);

// Source: /lib/core/api/api-configurations.js
(function(root) {

  'use strict';

  var availity = root.availity;

  availity.core.factory('avConfigurationsResource', function(AvApiResource) {
    return new AvApiResource({version: '/v1', url: '/configurations'});
  });

})(window);

// Source: /lib/core/api/api-log-messages.js
(function(root) {

  'use strict';

  var availity = root.availity;

  var LogMessagesFactory = function(AvApiResource) {

    var logMessagesResource = new AvApiResource({
      version: '/v1',
      url: '/log-messages'
    });

    var buildRequest = function(level, entries) {

      var requestPayload = {};

      if(entries.level) {
        delete entries.level;
      }

      requestPayload.level = level;
      requestPayload.entries = entries;

      return requestPayload;
    };

    return {

      debug: function(entries) {
        return logMessagesResource.create(buildRequest('debug', entries));
      },

      info: function(entries) {
        return logMessagesResource.create(buildRequest('info', entries));
      },

      warn: function(entries) {
        return logMessagesResource.create(buildRequest('warn', entries));
      },

      error: function(entries) {
        return logMessagesResource.create(buildRequest('error', entries));
      }

    };
  };

  availity.core.factory('avLogMessagesResource', LogMessagesFactory);

})(window);

// Source: /lib/core/api/api-documents.js
(function(root) {

  'use strict';

  var availity = root.availity;

  var AvDocumentsResourceFactory = function(AvApiResource) {

    var AvDocumentsResource = function() {
      AvApiResource.call(this, 'documents');
    };

    angular.extend(AvDocumentsResource.prototype, AvApiResource.prototype, {

      getContents: function(id) {
        var config = this._config();
        config.url = this.getContentsUrl(id);
        return this._request(config);
      },

      getContentsUrl: function(id) {
        return this._getUrl(id) + '/contents';
      }

    });

    return new AvDocumentsResource();

  };

  availity.core.factory('avDocumentsResource', AvDocumentsResourceFactory);

})(window);

// Source: /lib/core/api/api-organizations.js
(function(root) {

  'use strict';

  var availity = root.availity;

  var OrganizationResourceFactory = function(AvApiResource) {

    var OrganizationResource = function() {
      AvApiResource.call(this, 'organizations');
    };

    angular.extend(OrganizationResource.prototype, AvApiResource.prototype, {

      getOrganizations: function() {
        return this.all().then(function(response) {
          return response.data.organizations ? response.data.organizations : response.data;
        });
      }

    });

    return new OrganizationResource();
  };

  availity.core.factory('avOrganizationsResource', OrganizationResourceFactory);

})(window);

// Source: /lib/core/session/session.js
(function(root) {
  'use strict';

  var availity = root.availity;

  availity.core.constant('AV_SESSION', {
    SESSION_TIMEOUT: 'auth:session:timeout',
    NOT_AUTHORIZED: 'auth:not:authorized'
  });

  availity.core.factory('avSession', function($q, avUsersResource, avPermissionsResource) {

    var AvSession = function() {
      this.user = null;
      this.permissions = null;
    };

    var proto = AvSession.prototype;

    proto.getUser = function() {
      var self = this;

      if(this.user) {
        return $q.when(this.user);
      }

      return avUsersResource.me().then(function(user) {
        self.user = user;
        return self.user;
      });

    };

    proto.getPermissions = function() {
      var self = this;

      if(this.permissions) {
        return $q.when(this.permissions);
      }

      return avPermissionsResource.all().then(function(permissions) {
        self.permissions = permissions;
        return self.permissions;
      });

    };

    proto.destroy = function() {
      this.user = null;
      this.permisions = null;
    };

    return new AvSession();
  });

})(window);

// Source: /lib/core/validation/validator.js
(function(root) {

  'use strict';

  var availity = root.availity;

  availity.core.value('avValConfig', {
    classes: {
      valid: 'ng-valid',
      invalid: 'ng-invalid',
      dirty: 'ng-dirty',
      pristine: 'ng-pristine',
      touched: 'ng-touched',
      untouched: 'ng-untouched',
      submitted: 'ng-submitted'
    },
    validators: [
      'avValPattern',
      'avValSize',
      'avValRequired',
      'avValDateRange',
      'avValDate'
    ]
  });

  availity.core.constant('AV_VAL', {
    EVENTS: {
      REVALIDATE: 'av:val:revalidate',
      SUBMITTED: 'av:val:submitted'
    },
    DEBOUNCE: 500,
    DATE_FORMAT: {
      SIMPLE: 'MM/DD/YYYY'
    },
    PATTERNS: {
      ALPHA_ONLY: /[^A-Za-z]+/g,
      NUMERIC_ONLY: /[^0-9]+/g
    }
  });

  availity.core.provider('avVal', function() {

    var that = this;

    this.rules = {};

    this.addRules = function(rules) {
      this.rules = angular.extend(this.rules, rules);
    };

    this.$get = function($injector, $rootScope, $http, $log, avValConfig, AV_VAL) {

      var AvValidation = function() {
        this.rules = that.rules;
        this.validators = [];
        this.initValidators();
      };

      var proto = AvValidation.prototype;

      proto.initValidators = function() {
        var self = this;

        angular.forEach(avValConfig.validators, function(name) {
          var validator = $injector.get(name);
          self.validators[validator.name] = validator;
        });
      };

      proto.clearAll = function() {
        // this.validators.splice(0, this.validators.length);
        // this.rules = {};
      };

      proto.addRules = function(rules) {
        this.rules = angular.extend(this.rules, rules);
        $rootScope.$broadcast(AV_VAL.EVENTS.REVALIDATE);
      };

      proto.validate = function(element, value, ruleName) {

        var self = this;
        var rules = this.rules[ruleName];

        var el = element[0];
        var results  = [];
        var violations = [];
        var _valid = true;

        angular.forEach(rules, function(rule, contraintName) {

          var validator = self.validators[contraintName];

          if(angular.isUndefined(validator)) {
            $log.warn('No validator defined for `' + name + '`');
            return;
          }

          var valid = validator.validate(value, rule);

          var validationResult = {
            valid: valid,
            ruleName: ruleName,
            contraintName: contraintName,
            value: value,
            message: rule.message,
            field: el.name || el.id
          };

          $log.info(validationResult);

          var result = angular.extend({}, rule, validationResult);

          results.push(result);
          if(!valid) {
            violations.push(validationResult);
          }
          _valid = _valid && valid;
        });

        return {
          isValid: _valid,
          all: results, // all the constraint results
          violations: violations
        };

      };

      return new AvValidation();
    };

  });
})(window);

// Source: /lib/core/validation/validators/validator-utils.js
(function(root) {

  'use strict';

  var availity = root.availity;

  availity.core.factory('avValUtils', function() {

    return {

      isDefined: function(value) {
        return angular.isDefined(value) && value !== '' && value !== null;
      },

      isEmpty: function(value) {
        return !this.isDefined(value) || $.trim(value) === '';
      }
    };

  });
})(window);


// Source: /lib/core/validation/validators/validator-size.js
(function(root) {

  'use strict';

  var availity = root.availity;

  availity.core.factory('avValSize', function() {

    var validator =  {
      name: 'size',
      validate: function(value, rule) {
        var minLength = rule.min || 0;
        var maxLength = rule.max;

        value = value || '';
        return value.length >= minLength && (maxLength === undefined || value.length <= maxLength);
      }
    };

    return validator;

  });
})(window);

// Source: /lib/core/validation/validators/validator-pattern.js
(function(root) {
  'use strict';

  var availity = root.availity;

  availity.core.factory('avValPattern', function() {

    var validator =  {
      name: 'pattern',
      REGEX: /^\/(.*)\/([gim]*)$/, //regular expression to test a regular expression
      asRegExp: function(pattern) {
        var match;

        if(pattern.test) {
          return pattern;
        } else {
          match = pattern.match(validator.REGEX);
          if(match) {
            return new RegExp(match[1], match[2]);
          } else {
            throw ('Expected ' + pattern + ' to be a RegExp');
          }
        }
      },
      validate: function(value, rule) {
        var pattern = validator.asRegExp(rule.value);
        return pattern.test(value);
      }
    };

    return validator;

  });
})(window);

// Source: /lib/core/validation/validators/validator-required.js
(function(root) {

  'use strict';

  var availity = root.availity;

  availity.core.factory('avValRequired', function(avValUtils) {

    var validator =  {
      name: 'required',
      validate: function(value) {
        return !avValUtils.isEmpty(value);
      }
    };

    return validator;

  });
})(window);

// Source: /lib/core/validation/validators/validator-date-range.js
(function(root) {

  'use strict';

  var availity = root.availity;

  availity.core.factory('avValDateRange', function(AV_VAL) {

    var validator = {
      name: 'dateRange',
      getMinDate: function(minDate) {
        var period = minDate.replace(AV_VAL.PATTERNS.ALPHA_ONLY, '');
        var val = parseInt( minDate.replace(AV_VAL.PATTERNS.NUMERIC_ONLY, ''), 10);
        var min = moment().subtract(val, period);
        return min;
      },
      getMaxDate: function(maxDate) {
        var max = moment();
        var period = maxDate.replace(AV_VAL.PATTERNS.ALPHA_ONLY, '');
        var val = parseInt( maxDate.replace(AV_VAL.PATTERNS.NUMERIC_ONLY, ''), 10);

        if(maxDate !== 'today') {
          max = moment().add(val, period);
        } else {
          max.set('hours', 23);
          max.set('minutes', 59);
          max.set('seconds', 59);
        }
        return max;
      },
      validation: function(value, rules) {
        var minDate = validator.getMinDate(rules.min);
        var maxDate = validator.getMaxDate(rules.max);
        value = moment(value, rules.format);
        return !value.isBefore(minDate) && !value.isAfter(maxDate);
      },
      validate: function(value, rule) {
        return validator.validation(value, rule);
      }
    };

    return validator;
  });
})(window);

// Source: /lib/core/validation/validators/validator-date-format.js
(function(root) {

  'use strict';

  var availity = root.availity;

  availity.core.factory('avValDate', function(AV_VAL) {

    var validator = {
      name: 'dateFormat',
      validate: function(value, rules) {

        var format = rules && rules.format ? rules.format : AV_VAL.DATE_FORMAT.SIMPLE;

        return moment(value, format, true).isValid();
      }
    };
    return validator;
  });
})(window);

//# sourceMappingURL=maps/availity-angular.js.map