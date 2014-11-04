define([
  'jquery',
],
function ($) {
  'use strict';

  function GraphTooltip(elem, dashboard, scope, getSeriesFn) {
    var self = this;

    var $tooltip = $('<div id="tooltip">');

    this.findHoverIndexFromDataPoints = function(posX, series,last) {
      var ps = series.datapoints.pointsize;
      var initial = last*ps;
      var len = series.datapoints.points.length;
      for (var j = initial; j < len; j += ps) {
        if (series.datapoints.points[j] > posX) {
          return Math.max(j - ps,  0)/ps;
        }
      }
      return j/ps - 1;
    };

    this.findHoverIndexFromData = function(posX, series) {
      var len = series.data.length;
      for (var j = 0; j < len; j++) {
        if (series.data[j][0] > posX) {
          return Math.max(j - 1,  0);
        }
      }
      return j - 1;
    };

    this.findSerieIndexFromPos = function(pos, nbSeries) {
      var offset = elem.offset();
      var elemData = elem.data();
      return Math.min( nbSeries-1, Math.floor( (pos.pageY-offset.top) / (elemData.horizonHeight+elemData.marginBottom) ) );
    };

    this.showTooltip = function(title, innerHtml, pos) {
      var body = '<div class="graph-tooltip small"><div class="graph-tooltip-time">'+ title + '</div> ' ;
      body += innerHtml + '</div>';
      $tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    };

    this.getMultiSeriesPlotHoverInfo = function(seriesList, pos) {
      var value, i, series, hoverIndex;
      var results = [];

      var pointCount = seriesList[0].data.length;
      for (i = 1; i < seriesList.length; i++) {
        if (seriesList[i].data.length !== pointCount) {
          results.pointCountMismatch = true;
          return results;
        }
      }

      series = seriesList[0];
      hoverIndex = this.findHoverIndexFromData(pos.x, series);
      var lasthoverIndex = 0;
      if(!scope.panel.steppedLine) {
        lasthoverIndex = hoverIndex;
      }

      //now we know the current X (j) position for X and Y values
      results.time = series.data[hoverIndex][0];

      for (i = 0; i < seriesList.length; i++) {
        series = seriesList[i];

        if ( series.data[hoverIndex][1] ) {
          value = value || 0;
          value += series.data[hoverIndex][1];
        }
      }
      results.push({ value: value, hoverIndex: hoverIndex });

      return results;
    };

    elem.mouseleave(function (event) {
      if (scope.panel.tooltip.shared || dashboard.sharedCrosshair) {
        var plot = $(event.target).parent().data().plot;
        if (plot) {
          $tooltip.detach();
          plot.unhighlight();
          scope.appEvent('clearCrosshair');
        }
      }
    });

    elem.bind("plothover", function (event, pos, item) {
      var plot = $( event.target ).data().plot;
      var plotData = plot.getData();
      var seriesList = getSeriesFn();
      var value, timestamp, hoverInfo, series, seriesHtml;

      if (seriesList.length === 0) {
        return;
      }

      var serieIndex = self.findSerieIndexFromPos(pos, seriesList.length);

      plot.unhighlight();

      var seriesHoverInfo = self.getMultiSeriesPlotHoverInfo(plotData, pos);
      if (seriesHoverInfo.pointCountMismatch) {
        self.showTooltip('Shared tooltip error', '<ul>' +
          '<li>Series point counts are not the same</li>' +
          '<li>Set null point mode to null or null as zero</li>' +
          '<li>For influxdb users set fill(0) in your query</li></ul>', pos);
        return;
      }

      seriesHtml = '';
      timestamp = dashboard.formatDate(seriesHoverInfo.time);

      series = seriesList[serieIndex];
      if ( series ) {
        hoverInfo = seriesHoverInfo[0];
        value = series.formatValue(hoverInfo.value, 2, 2);

        seriesHtml = '<i class="icon-minus" style="color:' + series.color +';"></i> ' + series.label;
        seriesHtml += ': <span class="graph-tooltip-value">' + hoverInfo.value + '</span>';

        self.showTooltip(timestamp, seriesHtml, pos);
      }
    });
  }

  return GraphTooltip;
});
