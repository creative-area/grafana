require.config({
  paths: {
    'jquery.flot.florizon': 'app/panels/horizon/florizon'
  },
  shim: {
    'jquery.flot.florizon': ['jquery', 'jquery.flot']
  }
});
define([
  'angular',
  'jquery',
  'kbn',
  'moment',
  'lodash',
  './horizon.tooltip',
  'jquery.flot',
  'jquery.flot.florizon',
  'jquery.flot.selection',
  'jquery.flot.events',
  'jquery.flot.time',
  'jquery.flot.crosshair'
],
function (angular, $, kbn, moment, _, HorizonTooltip) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.directive('grafanaHorizon', function($rootScope, timeSrv) {
    return {
      restrict: 'A',
      template: '<div> </div>',
      link: function(scope, elem) {
        var dashboard = scope.dashboard;
        var data, annotations;
        var sortedSeries;
        var graphHeight;
        var legendSideLastValue = null;
        scope.crosshairEmiter = false;

        scope.onAppEvent('setCrosshair', function(event, info) {
          // do not need to to this if event is from this panel
          if (info.scope === scope) {
            return;
          }

          if(dashboard.sharedCrosshair) {
            var $horizonLines = elem.find(".horizon-tooltip");
            $horizonLines.each(function(i, horizonLine) {
              var plot = $(horizonLine).data().plot;
              if (plot) {
                plot.setCrosshair({ x: info.pos.x, y: info.pos.y });
              }
            });
          }
        });

        scope.onAppEvent('clearCrosshair', function() {
          var $horizonLines = elem.find(".horizon-tooltip");
          $horizonLines.each(function(i, horizonLine) {
            var plot = $(horizonLine).data().plot;
            if (plot) {
              plot.clearCrosshair();
            }
          });
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

        // NOTE: rewrited
        function setElementHeight() {
          try {
            graphHeight = scope.height || scope.panel.height || scope.row.height;
            if (_.isString(graphHeight)) {
              graphHeight = parseInt(graphHeight.replace('px', ''), 10);
            }
            if (data) {
              var seriesHeight = data.length * (scope.panel.horizon.horizonHeight + scope.panel.horizon.marginBottom);
              if (seriesHeight > graphHeight) {
                graphHeight = seriesHeight;
              }
            }
            graphHeight += scope.panel.horizon.axisHeight;
            elem.css('height', Math.min(graphHeight) + 'px');
            return true;
          } catch(e) { // IE throws errors sometimes
            return false;
          }
        }

        // NOTE: idem (except render_panel_as_graphite_png)
        function shouldAbortRender() {
          if (!data) {
            return true;
          }

          if ($rootScope.fullscreen && !scope.fullscreen) {
            return true;
          }

          if (!setElementHeight()) { return true; }

          // TODO: test png render (if works with phantomjs, it could works)
          // if (_.isString(data)) {
          //   render_panel_as_graphite_png(data);
          //   return true;
          // }

          if (elem.width() === 0) {
            return;
          }
        }

        // NOTE: moved in series: not used in graph.js
        // function updateLegendValues(plot) {
        //   var yaxis = plot.getYAxes();
        //   for (var i = 0; i < data.length; i++) {
        //     var series = data[i];
        //     var axis = yaxis[series.yaxis - 1];
        //     var formater = kbn.valueFormats[scope.panel.y_formats[series.yaxis - 1]];
        //     series.updateLegendValues(formater, axis.tickDecimals, axis.scaledDecimals);
        //     if(!scope.$$phase) { scope.$digest(); }
        //   }
        // }

        function drawHook(plot) {
          // Update legend values
          var yaxis = plot.getYAxes();
          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            var axis = yaxis[series.yaxis - 1];
            var formater = kbn.valueFormats[scope.panel.y_formats[series.yaxis - 1]];

            // decimal override
            if (_.isNumber(scope.panel.decimals)) {
              series.updateLegendValues(formater, scope.panel.decimals, null);
            } else {
              // auto decimals
              // legend and tooltip gets one more decimal precision
              // than graph legend ticks
              var tickDecimals = (axis.tickDecimals || -1) + 1;
              series.updateLegendValues(formater, tickDecimals, axis.scaledDecimals + 2);
            }

            if(!scope.$$phase) { scope.$digest(); }
          }

          // add left axis labels
          if (scope.panel.leftYAxisLabel) {
            var yaxisLabel = $("<div class='axisLabel left-yaxis-label'></div>")
              .text(scope.panel.leftYAxisLabel)
              .appendTo(elem);

            yaxisLabel.css("margin-top", yaxisLabel.width() / 2);
          }

          // add right axis labels
          if (scope.panel.rightYAxisLabel) {
            var rightLabel = $("<div class='axisLabel right-yaxis-label'></div>")
              .text(scope.panel.rightYAxisLabel)
              .appendTo(elem);

            rightLabel.css("margin-top", rightLabel.width() / 2);
          }
        }

        function processOffsetHook(plot, gridMargin) {
          if (scope.panel.leftYAxisLabel) { gridMargin.left = 20; }
          if (scope.panel.rightYAxisLabel) { gridMargin.right = 20; }
        }

        // Function for rendering panel
        function render_panel() {
          if (shouldAbortRender()) {
            return;
          }

          var panel = scope.panel;

          // Populate element
          var options = {
            hooks: {
              draw: [drawHook],
              processOffset: [processOffsetHook],
            },
            // hooks: { draw: [updateLegendValues] },
            legend: { show: true },
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
              backgroundColor: '#d1d1d1',
              borderWidth: 0,
              hoverable: true,
              color: '#d1d1d1'
            },
            selection: {
              mode: "x",
              color: '#666'
            },
            crosshair: {
              mode: "x" // panel.tooltip.shared || dashboard.sharedCrosshair ? "x" : null
            }
          };

          for (var i = 0; i < data.length; i++) {
            var series = data[i];
            series.applySeriesOverrides(panel.seriesOverrides);
            series.data = series.getFlotPairs(panel.nullPointMode, panel.y_formats);

            // if hidden remove points and disable stack
            if (scope.hiddenSeries[series.alias]) {
              series.data = [];
              series.stack = false;
            }
          }

          addTimeAxis(options);
          addAnnotations(options);
          configureAxisOptions(data, options);

          options.grid.backgroundColor = panel.horizon.backgroundColor;
          options.grid.color = panel.horizon.backgroundColor;

          sortedSeries = _.sortBy(data, function(series) { return series.zindex; });

          elem.data(options.series.horizon);

          function callPlot(incrementRenderCounter) {
            try {
              var $g;
              elem.html('');
              _.each(sortedSeries, function(serie, el) {
                if (options.xaxis) {
                  options.xaxis.show = false;
                }
                $g = $('<div>').data('pos', el).addClass('horizon-tooltip');
                $g.css({ 'height': options.series.horizon.horizonHeight+'px', 'margin-bottom': options.series.horizon.marginBottom+'px' });
                elem.append($g);
                $.plot($g, [serie], options);
              });
              // xaxis
              if (sortedSeries.length) {
                options.xaxis.show = true;
                $g = $('<div>');
                $g.css({ 'height': options.series.horizon.axisHeight+'px', 'margin-bottom': options.series.horizon.marginBottom+'px' });
                elem.append($g);
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

            if (incrementRenderCounter) {
              scope.panelRenderingComplete();
            }
          }

          if (shouldDelayDraw(panel)) {
            // temp fix for legends on the side, need to render twice to get dimensions right
            callPlot(false);
            setTimeout(function() { callPlot(true); }, 50);
            legendSideLastValue = panel.legend.rightSide;
          }
          else {
            callPlot(true);
          }
        }

        // NOTE: ok idem (check if use it ?)
        // function translateFillOption(fill) {
        //   return fill === 0 ? 0.001 : fill/10;
        // }

        // NOTE: ok idem (check if use it ?)
        function shouldDelayDraw(panel) {
          if (panel.legend.rightSide) {
            return true;
          }
          if (legendSideLastValue !== null && panel.legend.rightSide !== legendSideLastValue) {
            return true;
          }
        }

        // NOTE: rewrited (xaxis show = false)
        function addTimeAxis(options) {
          var ticks = elem.width() / 100;
          var min = _.isUndefined(scope.range.from) ? null : scope.range.from.valueOf();
          var max = _.isUndefined(scope.range.to) ? null : scope.range.to.valueOf();

          options.xaxis = {
            timezone: dashboard.timezone,
            show: false,// scope.panel['x-axis'],
            mode: "time",
            min: min,
            max: max,
            label: "Datetime",
            ticks: ticks,
            timeformat: time_format(scope.interval, ticks, min, max),
          };
        }

        // NOTE: ok idem
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
                  icon: "fa fa-chevron-down",
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

        // NOTE: rewrited (without pourcentage and stack)
        function configureAxisOptions(data, options) {
          var defaults = {
            position: 'left',
            show: scope.panel['y-axis'],
            min: scope.panel.grid.leftMin,
            index: 1,
            logBase: scope.panel.grid.leftLogBase || 1,
            max: scope.panel.grid.leftMax,
          };

          options.yaxes.push(defaults);
          // if (_.findWhere(data, {yaxis: 2})) {
          //   // TODO: check if needed (only 1 axis)
          //   var secondY = _.clone(defaults);
          //   secondY.index = 2,
          //   secondY.logBase = scope.panel.grid.rightLogBase || 1,
          //   secondY.position = 'right';
          //   secondY.min = scope.panel.grid.rightMin;
          //   secondY.max = scope.panel.grid.rightMax;
          //   options.yaxes.push(secondY);
          //
          //   applyLogScale(options.yaxes[1], data);
          //   configureAxisMode(options.yaxes[1], scope.panel.y_formats[1]);
          // }
          //
          // applyLogScale(options.yaxes[0], data);
          configureAxisMode(options.yaxes[0], scope.panel.y_formats[0]);
        }

        // NOTE: ok idem (OPTIONS EDITOR need to be implemented)
        function applyLogScale(axis, data) {
          if (axis.logBase === 1) {
            return;
          }

          var series, i;
          var max = axis.max;

          if (max === null) {
            for (i = 0; i < data.length; i++) {
              series = data[i];
              if (series.yaxis === axis.index) {
                if (max < series.stats.max) {
                  max = series.stats.max;
                }
              }
            }
            if (max === void 0) {
              max = Number.MAX_VALUE;
            }
          }

          axis.min = axis.min !== null ? axis.min : 0;
          axis.ticks = [0, 1];
          var nextTick = 1;

          while (true) {
            nextTick = nextTick * axis.logBase;
            axis.ticks.push(nextTick);
            if (nextTick > max) {
              break;
            }
          }

          if (axis.logBase === 10) {
            axis.transform = function(v) { return Math.log(v+0.1); };
            axis.inverseTransform  = function (v) { return Math.pow(10,v); };
          } else {
            axis.transform = function(v) { return Math.log(v+0.1) / Math.log(axis.logBase); };
            axis.inverseTransform  = function (v) { return Math.pow(axis.logBase,v); };
          }
        }

        // NOTE: ok idem
        function configureAxisMode(axis, format) {
          axis.tickFormatter = function(val, axis) {
            return kbn.valueFormats[format](val, axis.tickDecimals, axis.scaledDecimals);
          };
        }

        // NOTE: ok idem
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

        // TODO: need to be implemented
        new HorizonTooltip(elem, dashboard, scope, function() {
          return sortedSeries;
        });

        // NOTE: rewrited
        elem.bind("plotselected", function (event, ranges) {
          scope.$apply(function() {
            timeSrv.setTime({
              from  : moment.utc(ranges.xaxis.from),
              to    : moment.utc(ranges.xaxis.to),
            });
          });
        });
      }
    };
  });

});
