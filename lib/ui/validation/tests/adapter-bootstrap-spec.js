/*global beforeEach, expect, module, describe, it */


describe('adapter-bootstrap', function() {

  'use strict';

  beforeEach(function() {
    module('availity', function(avValProvider) {
      avValProvider.addRules({
        'lastName': {
          'size': {
            'min': 2,
            'max': 10,
            'message': 'Last name must be between 2 and 10 characters.'
          },
          'required': {
            'message': 'Last name is required.'
          }
        }
      });
    });
    module('availity.ui');
  });

  availity.mock.directiveSpecHelper();

  var $form;
  var $el;

  beforeEach(function() {

    var template = ''+
    '<form name="myForm" data-av-val-form>' +
      '<div class="form-group">' +
        '<label for="text3">Label for text input</label>' +
        '<input data-ng-model="model.lastName" name="lastName" type="text" data-av-val-field="lastName"/>' +
        '<p class="help-block">Example block-level help text here.</p>' +
      '</div>' +
    '</form>';

    $form = availity.mock.compileDirective(template);
    $el = $form.find('input[name="lastName"]');
  });

  describe('error decorator', function() {

    it('should NOT apply class .has-error to $pristine form', function() {
      expect($el.parent().hasClass('has-error')).toBe(false);
    });

    it('should NOT apply class .has-error for valid input', function() {
       availity.mock.$scope.myForm.lastName.$setViewValue('lastName');

       availity.mock.$scope.$digest();

       expect($el.parent().hasClass('has-error')).toBe(false);
       expect(availity.mock.$scope.myForm.lastName.$valid).toBe(true);
    });

    it('SHOULD apply class.has-error for invalid input', function() {
      availity.mock.$scope.myForm.lastName.$setViewValue('b');
      availity.mock.$scope.$digest();

      expect(availity.mock.$scope.myForm.lastName.$valid).toBe(false);
      expect($el.parent().hasClass('has-error')).toBe(true);
      expect(availity.mock.$scope.myForm.$valid).toBe(false);
      expect($el.hasClass('ng-invalid')).toBe(true);
     });
  });
});
