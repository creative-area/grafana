define([
  'angular',
  'jquery',
  'app/app',
  'lodash',
  'kbn',
  'moment',
  'app/components/timeSeries',
  'app/components/panelmeta',
  './seriesOverridesCtrl',
  './horizon',
  './legend',
],
function (angular, $, app, _, kbn, moment, TimeSeries, PanelMeta) {
  'use strict';

  var module = angular.module('grafana.panels.horizon');

  module.directive('grafanaPanelHorizon', function() {
    return {
      controller: 'HorizonCtrl',
      templateUrl: 'app/panels/horizon/module.html',
    };
  });

  module.controller('HorizonCtrl', function($scope, $rootScope, panelSrv, annotationsSrv, panelHelper, $q) {

    $scope.panelMeta = new PanelMeta({
      panelName: 'Horizon',
      editIcon:  "fa fa-align-justify",
      fullscreen: true,
      metricsEditor: true,
    });

    $scope.panelMeta.addEditorTab('Configuration', 'app/panels/horizon/configEditor.html');
    $scope.panelMeta.addEditorTab('Time range', 'app/features/panel/partials/panelTime.html');

    $scope.panelMeta.addExtendedMenuItem('Export CSV', '', 'exportCsv()');

    // Set and populate defaults
    var _d = {
      // datasource name, null = default datasource
      datasource: null,
      // sets client side (flot) or native graphite png renderer (png)
      renderer: 'flot',
      // Show/hide the x-axis
      'x-axis'      : true,
      // Show/hide y-axis
      'y-axis'      : false,
      // y axis formats, [left axis,right axis]
      y_formats    : ['short', 'short'],// axis 1 not used
      // grid options
      grid          : {
        leftLogBase: 1,
        leftMax: null,
        rightMax: null,
        leftMin: null,
        rightMin: null,
        rightLogBase: 1,
        threshold1: null,
        threshold2: null,
        threshold1Color: 'rgba(216, 200, 27, 0.27)',
        threshold2Color: 'rgba(234, 112, 112, 0.22)'
      },
      // legend options
      legend: {
        show: true, // disable/enable legend
        values: false, // disable/enable legend values
        min: false,
        max: false,
        current: false,
        total: false,
        avg: false
      },
      // horizon
      horizon: {
        bands: 6,
        horizonHeight: 32,
        axisHeight: 25,
        marginBottom: 2,
        backgroundColor: '#d1d1d1',
        labelColor: '#000000'
      },
      // how null points should be handled
      nullPointMode : 'connected',
      // tooltip options
      tooltip       : {
        value_type: 'cumulative',
        shared: true,
      },
      // time overrides
      timeFrom: null,
      timeShift: null,
      // metric queries
      targets: [{}],
      // other style overrides
      seriesOverrides: [],
    };

    _.defaults($scope.panel,_d);
    _.defaults($scope.panel.tooltip, _d.tooltip);
    _.defaults($scope.panel.annotate, _d.annotate);
    _.defaults($scope.panel.grid, _d.grid);
    _.defaults($scope.panel.legend, _d.legend);
    _.defaults($scope.panel.horizon, _d.horizon);

    $scope.logScales = {'linear': 1, 'log (base 2)': 2, 'log (base 10)': 10, 'log (base 32)': 32, 'log (base 1024)': 1024};

    $scope.hiddenSeries = {};
    $scope.seriesList = [];
    $scope.unitFormats = kbn.getUnitFormats();

    $scope.setUnitFormat = function(axis, subItem) {
      $scope.panel.y_formats[axis] = subItem.value;
      $scope.render();
    };

    $scope.refreshData = function(datasource) {
      panelHelper.updateTimeRange($scope);

      $scope.annotationsPromise = annotationsSrv.getAnnotations($scope.rangeRaw, $scope.dashboard);

      return panelHelper.issueMetricQuery($scope, datasource)
        .then($scope.dataHandler, function(err) {
          $scope.seriesList = [];
          $scope.render([]);
          throw err;
        });
    };

    $scope.loadSnapshot = function(snapshotData) {
      panelHelper.updateTimeRange($scope);
      $scope.annotationsPromise = $q.when([]);
      $scope.dataHandler(snapshotData);
    };

    $scope.dataHandler = function(results) {
      // png renderer returns just a url
      if (_.isString(results)) {
        $scope.render(results);
        return;
      }

      $scope.datapointsWarning = false;
      $scope.datapointsCount = 0;
      $scope.datapointsOutside = false;

      $scope.seriesList = _.map(results.data, $scope.seriesHandler);

      $scope.datapointsWarning = $scope.datapointsCount === 0 || $scope.datapointsOutside;

      $scope.annotationsPromise
        .then(function(annotations) {
          $scope.panelMeta.loading = false;
          $scope.seriesList.annotations = annotations;
          $scope.render($scope.seriesList);
        }, function() {
          $scope.panelMeta.loading = false;
          $scope.render($scope.seriesList);
        });
    };

    $scope.seriesHandler = function(seriesData, index) {
      var datapoints = seriesData.datapoints;
      var alias = seriesData.target;
      var series = new TimeSeries({
        datapoints: datapoints,
        alias: alias,
        index: index,
      });

      if (datapoints && datapoints.length > 0) {
        var last = moment.utc(datapoints[datapoints.length - 1][1]);
        var from = moment.utc($scope.range.from);
        if (last - from < -10000) {
          $scope.datapointsOutside = true;
        }

        $scope.datapointsCount += datapoints.length;
      }

      return series;
    };

    $scope.render = function(data) {
      panelHelper.broadcastRender($scope, data);
    };

    $scope.addSeriesOverride = function(override) {
      $scope.panel.seriesOverrides.push(override || {});
    };

    $scope.removeSeriesOverride = function(override) {
      $scope.panel.seriesOverrides = _.without($scope.panel.seriesOverrides, override);
      $scope.render();
    };

    $scope.legendValuesOptionChanged = function() {
      var legend = $scope.panel.legend;
      legend.values = legend.min || legend.max || legend.avg || legend.current || legend.total;
      $scope.render();
    };

    $scope.exportCsv = function() {
      kbn.exportSeriesListToCsv($scope.seriesList);
    };

    panelSrv.init($scope);

  });

});
