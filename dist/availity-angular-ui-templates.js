/**
 * availity-angular v0.2.0 -- February-16
 * Copyright 2015 Availity, LLC 
 */

(function() {
'use strict';
angular.module("availity.ui.templates", []).run(["$templateCache", function($templateCache) {$templateCache.put("ui/modal/modal-tpl.html","<div class=\"modal fade\" role=\"dialog\" tabindex=\"-1\"><div class=\"modal-dialog\"><div class=\"modal-content\" data-ng-transclude=\"\"></div></div></div>");
$templateCache.put("ui/navbar/navbar-tpl.html","<nav class=\"navbar navbar-default\" role=\"navigation\"><div class=\"container\"><div class=\"navbar-header\"><button type=\"button\" class=\"navbar-toggle collapsed\" data-toggle=\"collapse\" data-target=\"#availity-navbar-primary\"><span class=\"sr-only\">Toggle navigation</span> <span class=\"icon-bar\"></span> <span class=\"icon-bar\"></span> <span class=\"icon-bar\"></span></button> <a class=\"navbar-brand-availity\" href=\"#\"><img alt=\"Availity Logo\" src=\"images/logo-availity.png\"></a></div><div class=\"collapse navbar-collapse\" id=\"availity-navbar-primary\"><ul class=\"nav navbar-nav\"><li><a href=\"#\"><i class=\"icon icon-home navbar-default-icon\"></i> Home</a></li></ul><ul class=\"nav navbar-nav navbar-right\"><li class=\"dropdown\"><a href=\"#\" class=\"dropdown-toggle dropdown-toggle-secondary\" data-toggle=\"dropdown\"><i class=\"icon icon-help-circle\"></i> Help</a><ul class=\"dropdown-menu\" role=\"menu\"><li><a href=\"#\">Action</a></li><li><a href=\"#\">Another action</a></li><li><a href=\"#\">Something else here</a></li><li class=\"divider\"></li><li><a href=\"#\">Separated link</a></li></ul></li><li class=\"dropdown\"><a href=\"#\" class=\"dropdown-toggle dropdown-toggle-secondary\" data-toggle=\"dropdown\">{{currentUser.firstName}}\'s Account</a><ul class=\"dropdown-menu\" role=\"menu\"><li><a href=\"#\">Profile</a></li><li><a href=\"#\">Settings</a></li><li class=\"divider\"></li><li><a href=\"#\">Logout</a></li></ul></li></ul></div></div></nav>");}]);
var availity = window.availity || {}; if(typeof module !== 'undefined' && module.exports) {module.exports = availity; } })();

//# sourceMappingURL=maps/availity-angular-ui-templates.js.map