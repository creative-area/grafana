define([
  'angular',
  'app/app',
  'lodash',
  'require',
  'app/components/panelmeta',
],
function (angular, app, _, require, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.sample', []);
  app.useModule(module);

  module.directive('grafanaPanelSample', function() {
    return {
      controller: 'CustomPanelCtrl',
      templateUrl: 'app/panels/sample/module.html',
    };
  });

  module.controller('CustomPanelCtrl', function($scope, panelSrv) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Sample',
      editIcon:  "fa fa-text-width",
      fullscreen: true,
    });

    $scope.panelMeta.addEditorTab('Edit awesome text', 'app/panels/sample/editor.html');

    // set and populate defaults
    var _d = {
      title   : 'my default awesome title',
      content : "cool !",
      mode    : "text",
      style: {},
    };

    _.defaults($scope.panel, _d);

    $scope.init = function() {
      panelSrv.init($scope);
      $scope.ready = false;
      $scope.render();
    };

    $scope.refreshData = function() {
      $scope.panelMeta.loading = false;
      $scope.render();
    };

    $scope.render = function() {
      $scope.renderText($scope.panel.content);
      $scope.panelRenderingComplete();
    };

    $scope.renderText = function(content) {
      content = content
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;')
        .replace(/\n/g, '<br/>');

      // $scope.updateContent(content);
      $scope.content = content;
    };

    $scope.openEditor = function() {
    };

    $scope.init();
  });
});
