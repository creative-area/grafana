require.config({
  paths: {
    'jquery.flot.florizon':   '../plugins/horizon/florizon'
  },
  shim: {
    'jquery.flot.florizon': ['jquery', 'jquery.flot']
  }
});
define([
  'angular',
  'app',
  'jquery',
  'lodash',
  'kbn',
  'moment',
  'components/timeSeries',
  'components/panelmeta',
  'services/panelSrv',
  'services/annotationsSrv',
  'services/datasourceSrv',
  'panels/graph/seriesOverridesCtrl',
  './horizon'
],
function (angular, app, $, _, kbn, moment, TimeSeries, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.horizon', []);
  app.useModule(module);

  module.controller('HorizonCtrl', function($scope, $rootScope, panelSrv, annotationsSrv, timeSrv) {

    $scope.panelMeta = new PanelMeta({
      description: 'Horizon panel',
      fullscreen: true,
      metricsEditor: true
    });

    $scope.panelMeta.addEditorTab('Configuration', 'plugins/horizon/configEditor.html');

    // $scope.panelMeta.addExtendedMenuItem('Export CSV', '', 'exportCsv()');
    // $scope.panelMeta.addExtendedMenuItem('Toggle legend', '', 'toggleLegend()');

    // Set and populate defaults
    var _d = {

      datasource: null,

      /** @scratch /panels/histogram/3
       * x-axis:: Show the x-axis
       */
      'x-axis'      : true,
      /** @scratch /panels/histogram/3
       * y-axis:: Show the y-axis
       */
      'y-axis'      : false,
      /** @scratch /panels/histogram/3
       * scale:: Scale the y-axis by this factor
       */
      scale         : 1,
      /** @scratch /panels/histogram/3
       * y_formats :: 'none','bytes','bits','bps','short', 's', 'ms'
       */
      y_formats    : ['none', 'none'],
      /** @scratch /panels/histogram/5
       * grid object:: Min and max y-axis values
       * grid.min::: Minimum y-axis value
       * grid.ma1::: Maximum y-axis value
       */
      grid          : {
        leftMax: null,
        rightMax: null,
        leftMin: null,
        rightMin: null,
        threshold1: null,
        threshold2: null,
        threshold1Color: 'rgba(216, 200, 27, 0.27)',
        threshold2Color: 'rgba(234, 112, 112, 0.22)'
      },

      annotate      : {
        enable      : false,
      },

      /** @scratch /panels/histogram/3
       * legend:: Display the legend
       */
      legend: {
        show: true, // disable/enable legend
        values: false, // disable/enable legend values
        min: false,
        max: false,
        current: false,
        avg: false
      },

      horizon: {
        bands: 6,
        horizonHeight: 32,
        axisHeight: 25,
        marginBottom: 2,
        backgroundColor: '#d1d1d1',
        labelColor: '#000000'
      },

      targets: [{}],

      aliasColors: {},

      seriesOverrides: [],
    };

    _.defaults($scope.panel,_d);
    _.defaults($scope.panel.tooltip, _d.tooltip);
    _.defaults($scope.panel.annotate, _d.annotate);
    _.defaults($scope.panel.grid, _d.grid);
    _.defaults($scope.panel.legend, _d.legend);
    _.defaults($scope.panel.horizon, _d.horizon);

    $scope.hiddenSeries = {};

    $scope.updateTimeRange = function () {
      $scope.range = timeSrv.timeRange();
      $scope.rangeUnparsed = timeSrv.timeRange(false);
      if ($scope.panel.maxDataPoints) {
        $scope.resolution = $scope.panel.maxDataPoints;
      }
      else {
        $scope.resolution = Math.ceil($(window).width() * ($scope.panel.span / 12));
      }
      $scope.interval = kbn.calculateInterval($scope.range, $scope.resolution, $scope.panel.interval);
    };

    $scope.get_data = function() {
      $scope.updateTimeRange();

      var metricsQuery = {
        range: $scope.rangeUnparsed,
        interval: $scope.interval,
        targets: $scope.panel.targets,
        format: 'json',
        maxDataPoints: $scope.resolution,
        cacheTimeout: $scope.panel.cacheTimeout
      };

      $scope.annotationsPromise = annotationsSrv.getAnnotations($scope.rangeUnparsed, $scope.dashboard);

      return $scope.datasource.query(metricsQuery)
        .then($scope.dataHandler)
        .then(null, function(err) {
          $scope.panelMeta.loading = false;
          $scope.panelMeta.error = err.message || "Timeseries data request error";
          $scope.inspector.error = err;
          $scope.seriesList = [];
          $scope.render([]);
        });
    };

    $scope.dataHandler = function(results) {
      $scope.panelMeta.loading = false;
      $scope.legend = [];
      $scope.datapointsWarning = false;
      $scope.datapointsCount = 0;
      $scope.datapointsOutside = false;

      $scope.seriesList = _.map(results.data, $scope.seriesHandler);

      $scope.datapointsWarning = $scope.datapointsCount === 0 || $scope.datapointsOutside;

      $scope.annotationsPromise
        .then(function(annotations) {
          $scope.seriesList.annotations = annotations;
          $scope.render($scope.seriesList);
        }, function() {
          $scope.render($scope.seriesList);
        });
    };

    $scope.seriesHandler = function(seriesData, index) {
      var datapoints = seriesData.datapoints;
      var alias = seriesData.target;

      var series = new TimeSeries({
        datapoints: datapoints,
        alias: alias,
      });

      var seriesInfo = {
        alias: alias,
        index: index,
        horizon: $scope.panel.horizon
      };

      $scope.legend.push(seriesInfo);

      if (datapoints && datapoints.length > 0) {
        var last = moment.utc(datapoints[datapoints.length - 1][1] * 1000);
        var from = moment.utc($scope.range.from);
        if (last - from < -10000) {
          $scope.datapointsOutside = true;
        }

        $scope.datapointsCount += datapoints.length;
      }

      return series;
    };

    $scope.render = function(data) {
      var visibleSeries = 0;
      for ( var i = 0 ; i < $scope.panel.targets.length ; i++ ) {
        if ( $scope.panel.targets[i].hide !== true ) {
          visibleSeries++;
        }
      }
      $scope.panel.visibleSeries = visibleSeries;
      $scope.$emit('render', data);
    };

    $scope.toggleGridMinMax = function(key) {
      $scope.panel.grid[key] = _.toggle($scope.panel.grid[key], null, 0);
      $scope.render();
    };

    $scope.toggleEditorHelp = function(index) {
      if ($scope.editorHelpIndex === index) {
        $scope.editorHelpIndex = null;
        return;
      }
      $scope.editorHelpIndex = index;
    };

    $scope.init = function() {
      panelSrv.init($scope);
    };

    $scope.init();
  });

});
