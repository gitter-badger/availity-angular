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
