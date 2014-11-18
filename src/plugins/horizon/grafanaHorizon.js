define([
  'angular',
  'jquery',
  'kbn',
  'moment',
  'lodash',
  './grafanaHorizon.tooltip'
],
function (angular, $, kbn, moment, _, GraphTooltip) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('grafanaHorizon', function($rootScope, timeSrv) {
    return {
      restrict: 'A',
      template: '<div> </div>',
      link: function(scope, elem) {
        var dashboard = scope.dashboard;
        var data, annotations;
        scope.crosshairEmiter = false;

        scope.$on('refresh', function() {
          scope.get_data();
        });

        scope.$on('toggleLegend', function() {
          render_panel();
        });

        // Receive render events
        scope.$on('render',function(event, renderData) {
          data = renderData || data;
          if (!data) {
            scope.get_data();
            return;
          }
          annotations = data.annotations || annotations;
          render_panel();
        });

        function setElementHeight() {
          try {
            var height = scope.height || scope.panel.height || scope.row.height;
            if (_.isString(height)) {
              height = parseInt(height.replace('px', ''), 10);
            }
            if ( scope.panel && scope.panel.targets && scope.panel.horizon ) {
              var minHeight = scope.panel.targets.length * ( scope.panel.horizon.horizonHeight + scope.panel.horizon.marginBottom );
              minHeight += scope.panel.horizon.axisHeight;
            }
            elem.css('height', Math.min( minHeight ) + 'px');

            return true;
          } catch(e) { // IE throws errors sometimes
            return false;
          }
        }

        function shouldAbortRender() {
          if (!data) {
            return true;
          }

          if ($rootScope.fullscreen && !scope.fullscreen) {
            return true;
          }

          if (!setElementHeight()) { return true; }

          if (elem.width() === 0) {
            return;
          }
        }

        function updateLegendValues(plot) {
          var yaxis = plot.getYAxes();
          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            var axis = yaxis[series.yaxis - 1];
            var formater = kbn.valueFormats[scope.panel.y_formats[series.yaxis - 1]];
            series.updateLegendValues(formater, axis.tickDecimals, axis.scaledDecimals);
            if(!scope.$$phase) { scope.$digest(); }
          }
        }

        // Function for rendering panel
        function render_panel() {
          if (shouldAbortRender()) {
            return;
          }

          var panel = scope.panel;

          // Populate element
          var options = {
            hooks: { draw: [updateLegendValues] },
            legend: { show: false },
            series: {
              horizon: panel.horizon
            },
            yaxes: [{
              position: 'left',
              show: false,
              min: null,
              max: null
            }],
            xaxis: {},
            grid: {
              minBorderMargin: 0,
              markings: [],
              backgroundColor: 'white',
              borderWidth: 0,
              hoverable: true,
              color: 'white'
            },
            selection: {
              mode: "x",
              color: '#666'
            },
            crosshair: {
              mode: "x"
            }
          };

          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            series.applySeriesOverrides(panel.seriesOverrides);
            series.data = series.getFlotPairs(panel.nullPointMode, panel.y_formats);
            // if hidden remove points and disable stack
            if (scope.hiddenSeries[series.info.alias]) {
              series.data = [];
              series.stack = false;
            }
          }

          addTimeAxis(options);
          addAnnotations(options);
          configureAxisOptions(data, options);
          // TODO:
          // configureHorizonOptions(options);

          var sortedSeries = _.sortBy(data, function(series) { return series.zindex; });

          elem.data(options.series.horizon);

          function callPlot() {
            // console.log( options );
            try {
              var $g;
              elem.html( '' );
              // console.log( sortedSeries );
              _.each(sortedSeries, function(serie, el) {
                // console.log( serie );
                if ( options.xaxis ) {
                  options.xaxis.show = false;
                }
                $g = $( '<div>' ).data( 'pos', el ).addClass( 'horizon-tooltip' );
                $g.css({ 'height': options.series.horizon.horizonHeight+'px', 'margin-bottom': options.series.horizon.marginBottom+'px' });
                elem.append( $g );
                $.plot($g, [serie], options);
              });
              // xaxis
              if ( sortedSeries.length ) {
                options.xaxis.show = true;
                $g = $( '<div>' );
                $g.css({ 'height': options.series.horizon.axisHeight+'px', 'margin-bottom': options.series.horizon.marginBottom+'px' });
                elem.append( $g );
                $.plot($g, [], {
                  xaxis: options.xaxis,
                  series: {
                    lines: { show: false },
                    points: { show: false },
                    bars: { show: false }
                  },
                  grid: {
                    minBorderMargin: 0,
                    markings: [],
                    backgroundColor: null,
                    borderWidth: 0,
                    hoverable: false,
                    color: 'white'
                  }
                });
              }
            } catch (e) {
              console.log('flotcharts error', e);
            }
          }

          callPlot();
        }

        function addTimeAxis(options) {
          var ticks = elem.width() / 100;
          var min = _.isUndefined(scope.range.from) ? null : scope.range.from.getTime();
          var max = _.isUndefined(scope.range.to) ? null : scope.range.to.getTime();

          options.xaxis = {
            timezone: dashboard.timezone,
            show: false,
            mode: "time",
            min: min,
            max: max,
            label: "Datetime",
            ticks: ticks,
            timeformat: time_format(scope.interval, ticks, min, max),
          };
        }

        function addAnnotations(options) {
          if(!annotations || annotations.length === 0) {
            return;
          }

          var types = {};

          _.each(annotations, function(event) {
            if (!types[event.annotation.name]) {
              types[event.annotation.name] = {
                level: _.keys(types).length + 1,
                icon: {
                  icon: "icon-chevron-down",
                  size: event.annotation.iconSize,
                  color: event.annotation.iconColor,
                }
              };
            }

            if (event.annotation.showLine) {
              options.grid.markings.push({
                color: event.annotation.lineColor,
                lineWidth: 1,
                xaxis: { from: event.min, to: event.max }
              });
            }
          });

          options.events = {
            levels: _.keys(types).length + 1,
            data: annotations,
            types: types
          };
        }

        function configureAxisOptions(data, options) {
          var defaults = {
            position: 'left',
            show: scope.panel['y-axis'],
            min: scope.panel.grid.leftMin,
            max: scope.panel.percentage && scope.panel.stack ? 100 : scope.panel.grid.leftMax,
          };

          options.yaxes.push(defaults);

          if (_.findWhere(data, {yaxis: 2})) {
            var secondY = _.clone(defaults);
            secondY.position = 'right';
            secondY.min = scope.panel.grid.rightMin;
            secondY.max = scope.panel.percentage && scope.panel.stack ? 100 : scope.panel.grid.rightMax;
            options.yaxes.push(secondY);
            configureAxisMode(options.yaxes[1], scope.panel.y_formats[1]);
          }

          configureAxisMode(options.yaxes[0], scope.panel.y_formats[0]);
        }

        function configureAxisMode(axis, format) {
          axis.tickFormatter = function(val, axis) {
            return kbn.valueFormats[format](val, axis.tickDecimals, axis.scaledDecimals);
          };
        }

        function time_format(interval, ticks, min, max) {
          if (min && max && ticks) {
            var secPerTick = ((max - min) / ticks) / 1000;

            if (secPerTick <= 45) {
              return "%H:%M:%S";
            }
            if (secPerTick <= 3600) {
              return "%H:%M";
            }
            if (secPerTick <= 80000) {
              return "%m/%d %H:%M";
            }
            if (secPerTick <= 2419200) {
              return "%m/%d";
            }
            return "%Y-%m";
          }

          return "%H:%M";
        }

        new GraphTooltip(elem, dashboard, scope, function() {
          return data;
        });

        elem.bind("plotselected", function (event, ranges) {
          scope.$apply(function() {
            timeSrv.setTime({
              from  : moment.utc(ranges.xaxis.from).toDate(),
              to    : moment.utc(ranges.xaxis.to).toDate(),
            });
          });
        });
      }
    };
  });

});
