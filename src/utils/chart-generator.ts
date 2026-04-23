import type { ColumnInfo, PreviewRow } from "../types.js";

export interface ChartData {
  title: string;
  subtitle: string;
  url: string;
  columns: ColumnInfo[];
  rows: PreviewRow[];
  totalRows?: number;
}

export function buildDashboardHTML(data: ChartData): string {
  const escapedData = JSON.stringify({
    columns: data.columns,
    rows: data.rows,
    totalRows: data.totalRows,
  }).replace(/<\//g, "<\\/");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(data.title)} — Mobus Explorer</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0f1117;--surface:#1a1d27;--surface2:#252833;--border:#2e3241;--text:#e4e6f0;--text2:#9ca0b0;--accent:#6366f1;--accent2:#818cf8;--accent-bg:rgba(99,102,241,.12);--green:#22c55e;--red:#ef4444;--amber:#f59e0b;--radius:8px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);height:100vh;overflow:hidden;display:flex;flex-direction:column}
button{cursor:pointer;font-family:inherit;border:1px solid var(--border);background:var(--surface2);color:var(--text);padding:6px 14px;border-radius:var(--radius);font-size:13px;transition:.15s}
button:hover{border-color:var(--accent);background:var(--accent-bg)}
button.active{background:var(--accent);color:#fff;border-color:var(--accent)}
select,input[type=text],input[type=number]{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:var(--radius);font-size:13px;width:100%}
select:focus,input:focus{outline:none;border-color:var(--accent)}
label{font-size:12px;color:var(--text2);display:block;margin-bottom:4px;font-weight:500;text-transform:uppercase;letter-spacing:.5px}

.header{display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--border);flex-shrink:0}
.header h1{font-size:16px;font-weight:600}
.header .meta{font-size:12px;color:var(--text2)}
.header a{color:var(--accent2);text-decoration:none;font-size:12px}
.header a:hover{text-decoration:underline}

.main{display:flex;flex:1;overflow:hidden;min-height:0}

.sidebar{width:260px;background:var(--surface);border-right:1px solid var(--border);padding:16px;overflow-y:auto;flex-shrink:0;display:flex;flex-direction:column;gap:16px}
.sidebar section h3{font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:var(--text2);margin-bottom:8px}
.col-list{max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:2px}
.col-item{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;font-size:13px;cursor:pointer}
.col-item:hover{background:var(--surface2)}
.col-item input[type=checkbox]{accent-color:var(--accent)}
.col-item .ctype{font-size:10px;color:var(--text2);margin-left:auto;background:var(--surface2);padding:1px 6px;border-radius:3px;flex-shrink:0}

.content{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}

.toolbar{display:flex;gap:8px;padding:12px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap;align-items:center;flex-shrink:0}
.toolbar .group{display:flex;gap:4px;align-items:center}
.toolbar .group label{margin-bottom:0;margin-right:4px}
.toolbar .sep{width:1px;height:24px;background:var(--border);margin:0 4px}

.chart-wrap{flex:1;position:relative;min-height:200px}
#chart{position:absolute;top:0;left:0;right:0;bottom:0}

.table-wrap{display:none;flex:1;overflow:auto;padding:0}
.table-wrap table{width:100%;border-collapse:collapse;font-size:13px}
.table-wrap th{position:sticky;top:0;background:var(--surface);padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--text2);border-bottom:1px solid var(--border);cursor:pointer;white-space:nowrap;user-select:none}
.table-wrap th:hover{color:var(--accent2)}
.table-wrap th .arrow{margin-left:4px;font-size:10px}
.table-wrap td{padding:6px 12px;border-bottom:1px solid var(--border);white-space:nowrap;max-width:300px;overflow:hidden;text-overflow:ellipsis}
.table-wrap tr:hover td{background:var(--surface2)}
.table-wrap .null-val{color:var(--text2);font-style:italic}

.statusbar{display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:var(--surface);border-top:1px solid var(--border);font-size:12px;color:var(--text2);flex-shrink:0}

.view-toggle{display:flex;gap:0}
.view-toggle button{border-radius:0}
.view-toggle button:first-child{border-radius:var(--radius) 0 0 var(--radius)}
.view-toggle button:last-child{border-radius:0 var(--radius) var(--radius) 0}

.filter-row{display:flex;gap:6px;align-items:center;font-size:13px}
.filter-row select{width:auto;flex:1}
.filter-row .remove-filter{background:none;border:none;color:var(--red);font-size:16px;padding:2px 6px;cursor:pointer}
.filters-container{display:flex;flex-direction:column;gap:6px}
.add-filter-btn{font-size:12px;color:var(--accent2);background:none;border:none;cursor:pointer;padding:4px 0;text-align:left}
.add-filter-btn:hover{text-decoration:underline}

.export-menu{position:relative;display:inline-block}
.export-dropdown{display:none;position:absolute;right:0;top:100%;margin-top:4px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:4px 0;z-index:100;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.export-dropdown.show{display:block}
.export-dropdown button{display:block;width:100%;text-align:left;border:none;border-radius:0;padding:8px 14px;font-size:13px}
.export-dropdown button:hover{background:var(--accent-bg)}

.loading-msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--text2);font-size:14px}
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>${esc(data.title)}</h1>
    <span class="meta">${esc(data.subtitle)}</span>
  </div>
  <div style="display:flex;gap:12px;align-items:center">
    <a href="${esc(data.url)}" target="_blank">View on source →</a>
  </div>
</div>

<div class="main">
  <div class="sidebar">
    <section>
      <h3>Columns</h3>
      <div class="col-list" id="colList"></div>
    </section>
    <section>
      <h3>Filters</h3>
      <div class="filters-container" id="filtersContainer"></div>
      <button class="add-filter-btn" id="addFilterBtn">+ Add filter</button>
    </section>
    <section>
      <h3>Row Range</h3>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="number" id="rowStart" value="0" min="0" style="width:70px">
        <span style="color:var(--text2)">to</span>
        <input type="number" id="rowEnd" value="0" min="1" style="width:70px">
      </div>
    </section>
  </div>

  <div class="content">
    <div class="toolbar">
      <div class="view-toggle">
        <button class="active" id="btnChart">Chart</button>
        <button id="btnTable">Table</button>
      </div>
      <div class="sep"></div>
      <div class="group">
        <label>Type</label>
        <select id="chartType">
          <option value="auto">Auto</option>
          <option value="bar">Bar</option>
          <option value="horizontal_bar">H-Bar</option>
          <option value="pie">Pie</option>
          <option value="line">Line</option>
          <option value="scatter">Scatter</option>
          <option value="histogram">Histogram</option>
          <option value="heatmap">Missing Heatmap</option>
          <option value="box">Box Plot</option>
        </select>
      </div>
      <div class="group">
        <label>X Axis</label>
        <select id="xAxis"></select>
      </div>
      <div class="group">
        <label>Y Axis</label>
        <select id="yAxis">
          <option value="__count__">Count</option>
        </select>
      </div>
      <div class="group">
        <label>Group By</label>
        <select id="groupBy">
          <option value="">None</option>
        </select>
      </div>
      <div class="sep"></div>
      <div class="export-menu">
        <button id="exportBtn">Export ▾</button>
        <div class="export-dropdown" id="exportDropdown">
          <button id="expPng">Save as PNG</button>
          <button id="expSvg">Save as SVG</button>
          <button id="expCsv">Download CSV</button>
          <button id="expJson">Download JSON</button>
        </div>
      </div>
    </div>

    <div class="chart-wrap" id="chartWrap">
      <div id="chart"></div>
      <div class="loading-msg" id="loadingMsg">Loading chart...</div>
    </div>
    <div class="table-wrap" id="tableWrap"></div>
  </div>
</div>

<div class="statusbar">
  <span id="statusLeft">Loading...</span>
  <span id="statusRight"></span>
</div>

<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"><\/script>
<script>
(function(){
"use strict";

var RAW = ${escapedData};
var COLS = RAW.columns;
var ROWS = RAW.rows;

var state = {
  activeCols: COLS.filter(function(c){return c.name && c.name.length > 0;}).map(function(c){return c.name;}),
  view: 'chart',
  chartType: 'auto',
  xAxis: '',
  yAxis: '__count__',
  groupBy: '',
  rowStart: 0,
  rowEnd: ROWS.length,
  filters: [],
  tableSort: { col: '', asc: true },
};

function $(id){return document.getElementById(id);}

var chartDom = $('chart');
var chart = null;

function ensureChart() {
  if (chart) return chart;
  if (typeof echarts === 'undefined') return null;
  try {
    chart = echarts.init(chartDom, 'dark');
    window.addEventListener('resize', function(){if(chart)chart.resize();});
  } catch(e) {
    console.error('ECharts init failed:', e);
  }
  return chart;
}

function inferDtype(colName) {
  var nums=0, strs=0;
  for (var i=0;i<ROWS.length;i++) {
    var v=ROWS[i][colName];
    if (v===null||v===undefined||v==='') continue;
    if (typeof v==='number') nums++;
    else strs++;
  }
  if (nums>strs) return 'number';
  return 'string';
}

function uniqueValues(colName, rows) {
  var s={};var arr=[];
  for (var i=0;i<rows.length;i++) {
    var v=rows[i][colName];
    if (v!==null&&v!==undefined&&v!=='') {
      var k=String(v);
      if (!s[k]) { s[k]=true; arr.push(k); }
    }
  }
  return arr.sort();
}

function getFilteredRows() {
  var rows=ROWS.slice(state.rowStart, state.rowEnd);
  for (var fi=0;fi<state.filters.length;fi++) {
    var f=state.filters[fi];
    if (!f.col||!f.val) continue;
    rows=rows.filter(function(r){return String(r[f.col]??'')=== f.val;});
  }
  return rows;
}

function countByCategory(rows, col) {
  var m={};var keys=[];
  for (var i=0;i<rows.length;i++) {
    var v=rows[i][col];
    if (v===null||v===undefined||v==='') v='(null)';
    var key=String(v);
    if (!m[key]) { m[key]=0; keys.push(key); }
    m[key]++;
  }
  keys.sort(function(a,b){return m[b]-m[a];});
  return keys.map(function(k){return [k,m[k]];});
}

function splitMultiValue(rows, col) {
  var m={};var keys=[];
  for (var i=0;i<rows.length;i++) {
    var v=rows[i][col];
    if (v===null||v===undefined||v==='') {
      if (!m['(null)']) { m['(null)']=0; keys.push('(null)'); }
      m['(null)']++;
      continue;
    }
    var parts=String(v).split(',');
    for (var j=0;j<parts.length;j++) {
      var p=parts[j].trim();
      if (!p) continue;
      if (!m[p]) { m[p]=0; keys.push(p); }
      m[p]++;
    }
  }
  keys.sort(function(a,b){return m[b]-m[a];});
  return keys.map(function(k){return [k,m[k]];});
}

function numericValues(rows, col) {
  var vals=[];
  for (var i=0;i<rows.length;i++) {
    var v=rows[i][col];
    if (typeof v==='number'&&!isNaN(v)) vals.push(v);
  }
  return vals;
}

function hasCommas(rows, col) {
  var count=0;
  var lim=Math.min(rows.length,50);
  for (var i=0;i<lim;i++){
    if (typeof rows[i][col]==='string'&&rows[i][col].indexOf(',')>=0) count++;
  }
  return count>rows.length*0.1;
}

function autoDetect(colName) {
  var dtype=inferDtype(colName);
  if (dtype==='number') return 'histogram';
  var uv=uniqueValues(colName, ROWS);
  if (uv.length<=8) return 'pie';
  return 'bar';
}

function emptyOption(msg) {
  return {title:{text:msg,left:'center',top:'center',textStyle:{color:'#9ca0b0',fontSize:14}}};
}

function calcBoxStats(vals) {
  if (vals.length===0) return [0,0,0,0,0];
  vals.sort(function(a,b){return a-b;});
  function q(p){var i=p*(vals.length-1);var lo=Math.floor(i);var hi=Math.ceil(i);return vals[lo]+(vals[hi]-vals[lo])*(i-lo);}
  return [vals[0],q(.25),q(.5),q(.75),vals[vals.length-1]];
}

function buildGroupedBar(rows, xCol, isHoriz, base) {
  var gCol=state.groupBy;
  var groups=uniqueValues(gCol, rows);
  var catMap={};var cats=[];
  for (var i=0;i<rows.length;i++){
    var k=String(rows[i][xCol]!=null?rows[i][xCol]:'(null)');
    if (!catMap[k]){catMap[k]=true;cats.push(k);}
  }
  var series=groups.map(function(g){
    var gRows=rows.filter(function(r){return String(r[gCol]??'')=== g;});
    var counts={};
    for (var i=0;i<gRows.length;i++) counts[String(gRows[i][xCol]!=null?gRows[i][xCol]:'(null)')]=(counts[String(gRows[i][xCol]!=null?gRows[i][xCol]:'(null)')]||0)+1;
    return {type:'bar',name:g,data:cats.map(function(c){return counts[c]||0;})};
  });
  var catAxis={type:'category',data:cats,axisLabel:{fontSize:11,rotate:isHoriz?0:45}};
  var valAxis={type:'value'};
  return Object.assign({},base,{
    tooltip:{trigger:'axis'},
    legend:{type:'scroll',top:4,textStyle:{color:'#9ca0b0'}},
    grid:{containLabel:true,left:40,right:20,top:40,bottom:60},
    xAxis:isHoriz?valAxis:catAxis,
    yAxis:isHoriz?catAxis:valAxis,
    series:series
  });
}

function buildMissingHeatmap(rows, base) {
  var cols=state.activeCols;
  var data=[];
  for (var ci=0;ci<cols.length;ci++){
    var missing=0;
    for (var ri=0;ri<rows.length;ri++) {
      var v=rows[ri][cols[ci]];
      if (v===null||v===undefined||v==='') missing++;
    }
    var pct=rows.length>0?Math.round(missing/rows.length*100):0;
    data.push([0,ci,pct]);
  }
  return Object.assign({},base,{
    tooltip:{formatter:function(p){return cols[p.value[1]]+': '+p.value[2]+'% missing';}},
    grid:{left:160,right:40,top:20,bottom:40},
    xAxis:{type:'category',data:['Missing %'],axisLabel:{fontSize:12}},
    yAxis:{type:'category',data:cols,axisLabel:{fontSize:11}},
    visualMap:{min:0,max:100,calculable:true,orient:'horizontal',left:'center',bottom:4,
      inRange:{color:['#1a1d27','#f59e0b','#ef4444']},textStyle:{color:'#9ca0b0'}},
    series:[{type:'heatmap',data:data,label:{show:true,formatter:function(p){return p.value[2]+'%';},fontSize:12}}]
  });
}

function buildBoxPlot(rows, base) {
  var numCols=state.activeCols.filter(function(c){return inferDtype(c)==='number';});
  if (numCols.length===0) return emptyOption('No numeric columns for box plot');
  var gCol=state.groupBy;
  if (gCol) {
    var groups=uniqueValues(gCol, rows);
    var boxData=groups.map(function(g){
      var vals=numericValues(rows.filter(function(r){return String(r[gCol])=== g;}), state.xAxis);
      return calcBoxStats(vals);
    });
    return Object.assign({},base,{
      tooltip:{trigger:'item'},
      xAxis:{type:'category',data:groups,axisLabel:{rotate:45,fontSize:11}},
      yAxis:{type:'value'},
      series:[{type:'boxplot',data:boxData}]
    });
  }
  var boxData2=numCols.map(function(c){return calcBoxStats(numericValues(rows,c));});
  return Object.assign({},base,{
    tooltip:{trigger:'item'},
    xAxis:{type:'category',data:numCols,axisLabel:{rotate:45,fontSize:11}},
    yAxis:{type:'value'},
    series:[{type:'boxplot',data:boxData2}]
  });
}

function buildOption() {
  var rows=getFilteredRows();
  var xCol=state.xAxis;
  var yCol=state.yAxis;
  if (!xCol) return emptyOption('Select a column for X Axis');
  var type=state.chartType==='auto'? autoDetect(xCol) : state.chartType;

  var base = {
    backgroundColor:'transparent',
    toolbox:{right:16,top:8,feature:{dataZoom:{},restore:{}}},
    tooltip:{trigger:'item',confine:true},
    grid:{containLabel:true,left:40,right:20,top:40,bottom:60},
    animation:true,
  };

  if (type==='heatmap') return buildMissingHeatmap(rows, base);
  if (type==='box') return buildBoxPlot(rows, base);

  if (type==='pie') {
    var counts = hasCommas(rows, xCol) ? splitMultiValue(rows, xCol) : countByCategory(rows, xCol);
    return Object.assign({},base,{
      tooltip:{trigger:'item',formatter:'{b}: {c} ({d}%)'},
      legend:{type:'scroll',bottom:10,textStyle:{color:'#9ca0b0'}},
      series:[{
        type:'pie',radius:['35%','65%'],center:['50%','45%'],
        label:{formatter:'{b}\\n{d}%',fontSize:12},
        data:counts.map(function(c){return {name:c[0],value:c[1]};}),
        emphasis:{itemStyle:{shadowBlur:10,shadowColor:'rgba(0,0,0,.3)'}},
      }]
    });
  }

  if (type==='histogram') {
    var vals=numericValues(rows, xCol);
    if (vals.length===0) return emptyOption('No numeric data in '+xCol);
    var mn=Math.min.apply(null,vals), mx=Math.max.apply(null,vals);
    var bins=Math.min(30, Math.ceil(Math.sqrt(vals.length)));
    var step=(mx-mn)/bins||1;
    var buckets=[];for(var bi=0;bi<bins;bi++)buckets.push(0);
    var labels=[];
    for (var i=0;i<bins;i++) labels.push((mn+i*step).toFixed(1));
    for (var vi=0;vi<vals.length;vi++){var idx=Math.min(Math.floor((vals[vi]-mn)/step),bins-1);buckets[idx]++;}
    return Object.assign({},base,{
      tooltip:{trigger:'axis'},
      xAxis:{type:'category',data:labels,axisLabel:{rotate:45,fontSize:11}},
      yAxis:{type:'value'},
      series:[{type:'bar',data:buckets,itemStyle:{color:'#6366f1',borderRadius:[4,4,0,0]}}]
    });
  }

  if (type==='scatter') {
    var points=[];
    for (var si=0;si<rows.length;si++){
      var x=rows[si][xCol], y=yCol==='__count__'?1:rows[si][yCol];
      if (typeof x==='number'&&typeof y==='number') points.push([x,y]);
    }
    return Object.assign({},base,{
      tooltip:{trigger:'item',formatter:function(p){return xCol+': '+p.value[0]+'<br>'+yCol+': '+p.value[1];}},
      xAxis:{type:'value',name:xCol},
      yAxis:{type:'value',name:yCol==='__count__'?'Count':yCol},
      series:[{type:'scatter',data:points,symbolSize:8,itemStyle:{color:'#818cf8',opacity:.7}}]
    });
  }

  if (type==='line') {
    if (yCol==='__count__') {
      var lc=countByCategory(rows,xCol);
      return Object.assign({},base,{
        tooltip:{trigger:'axis'},
        xAxis:{type:'category',data:lc.map(function(c){return c[0];}),axisLabel:{rotate:45,fontSize:11}},
        yAxis:{type:'value'},
        series:[{type:'line',data:lc.map(function(c){return c[1];}),smooth:true,areaStyle:{opacity:.15},itemStyle:{color:'#6366f1'}}]
      });
    }
    var pts=[];
    for(var li=0;li<rows.length;li++){if(rows[li][yCol]!=null)pts.push([rows[li][xCol],rows[li][yCol]]);}
    return Object.assign({},base,{
      tooltip:{trigger:'axis'},
      xAxis:{type:'category',data:pts.map(function(p){return String(p[0]);}),axisLabel:{rotate:45,fontSize:11}},
      yAxis:{type:'value',name:yCol},
      series:[{type:'line',data:pts.map(function(p){return p[1];}),smooth:true,itemStyle:{color:'#6366f1'}}]
    });
  }

  // bar / horizontal_bar
  var isHoriz=type==='horizontal_bar';
  if (state.groupBy) return buildGroupedBar(rows, xCol, isHoriz, base);
  var bc = hasCommas(rows, xCol) ? splitMultiValue(rows, xCol) : countByCategory(rows, xCol);
  var catData=bc.map(function(c){return c[0];});
  var valData=bc.map(function(c){return c[1];});
  var catAxis={type:'category',data:catData,axisLabel:{fontSize:11,rotate:isHoriz?0:45}};
  var valAxis={type:'value'};
  return Object.assign({},base,{
    tooltip:{trigger:'axis'},
    grid:{containLabel:true,left:40,right:20,top:40,bottom:60},
    xAxis:isHoriz?valAxis:catAxis,
    yAxis:isHoriz?catAxis:valAxis,
    series:[{type:'bar',data:valData,itemStyle:{color:'#6366f1',borderRadius:isHoriz?[0,4,4,0]:[4,4,0,0]}}]
  });
}

function render() {
  var c=ensureChart();
  if (!c) return;
  try {
    var opt=buildOption();
    c.setOption(opt, true);
    var lm=$('loadingMsg');
    if(lm)lm.style.display='none';
  } catch(e) {
    console.error('Chart render error:', e);
  }
  updateStatus();
}

function updateStatus() {
  var rows=getFilteredRows();
  $('statusLeft').textContent=rows.length+' rows displayed'+(RAW.totalRows?' of ~'+RAW.totalRows+' total':'');
  $('statusRight').textContent=state.activeCols.length+' columns selected';
}

function escHtml(s){
  var d=document.createElement('div');d.textContent=s;return d.innerHTML;
}

// ── Column list ──
function buildColList() {
  var el=$('colList');
  el.innerHTML='';
  for (var ci=0;ci<COLS.length;ci++) {
    var c=COLS[ci];
    if (!c.name) continue;
    var d=document.createElement('div');
    d.className='col-item';
    var cb=document.createElement('input');
    cb.type='checkbox';
    cb.checked=state.activeCols.indexOf(c.name)>=0;
    cb.setAttribute('data-col',c.name);
    cb.addEventListener('change',(function(name){return function(e){
      if (e.target.checked) { if (state.activeCols.indexOf(name)<0) state.activeCols.push(name); }
      else state.activeCols=state.activeCols.filter(function(n){return n!==name;});
      render();
    };})(c.name));
    var span=document.createElement('span');
    span.textContent=c.name.length>20?c.name.slice(0,20)+'...':c.name;
    span.title=c.name;
    span.style.cssText='overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px';
    var tag=document.createElement('span');
    tag.className='ctype';
    tag.textContent=inferDtype(c.name);
    d.appendChild(cb);d.appendChild(span);d.appendChild(tag);
    el.appendChild(d);
  }
}

// ── Axis selectors ──
function buildAxisSelectors() {
  var cols=COLS.filter(function(c){return c.name;});
  var sels=[$('xAxis'),$('groupBy')];
  for (var si=0;si<sels.length;si++){
    var sel=sels[si];
    var prev=sel.value;
    sel.innerHTML=sel.id==='groupBy'?'<option value="">None</option>':'';
    for (var i=0;i<cols.length;i++){
      var o=document.createElement('option');
      o.value=cols[i].name;o.textContent=cols[i].name.length>30?cols[i].name.slice(0,30)+'...':cols[i].name;
      sel.appendChild(o);
    }
    if (prev) sel.value=prev;
  }
  var ySel=$('yAxis');
  var prevY=ySel.value;
  ySel.innerHTML='<option value="__count__">Count</option>';
  for (var yi=0;yi<cols.length;yi++){
    if (inferDtype(cols[yi].name)==='number'){
      var o2=document.createElement('option');
      o2.value=cols[yi].name;o2.textContent=cols[yi].name;
      ySel.appendChild(o2);
    }
  }
  if (prevY) ySel.value=prevY;
}

// ── Filters ──
function buildFilter() {
  var cols=COLS.filter(function(c){return c.name;});
  var container=$('filtersContainer');
  var idx=state.filters.length;
  state.filters.push({col:'',val:''});

  var row=document.createElement('div');
  row.className='filter-row';

  var colSel=document.createElement('select');
  colSel.innerHTML='<option value="">Column</option>'+cols.map(function(c){
    var label=c.name.length>25?c.name.slice(0,25)+'...':c.name;
    return '<option value="'+escHtml(c.name)+'">'+escHtml(label)+'</option>';
  }).join('');

  var valSel=document.createElement('select');
  valSel.innerHTML='<option value="">Value</option>';
  valSel.disabled=true;

  colSel.addEventListener('change',function(){
    state.filters[idx].col=colSel.value;
    if (colSel.value) {
      var uv=uniqueValues(colSel.value, ROWS).slice(0,100);
      valSel.innerHTML='<option value="">All</option>'+uv.map(function(v){
        var label=v.length>30?v.slice(0,30)+'...':v;
        return '<option value="'+escHtml(v)+'">'+escHtml(label)+'</option>';
      }).join('');
      valSel.disabled=false;
    } else { valSel.disabled=true; }
    render();
  });
  valSel.addEventListener('change',function(){state.filters[idx].val=valSel.value;render();});

  var rm=document.createElement('button');
  rm.className='remove-filter';rm.textContent='\\u00d7';
  rm.addEventListener('click',function(){state.filters.splice(idx,1);row.remove();render();});

  row.appendChild(colSel);row.appendChild(valSel);row.appendChild(rm);
  container.appendChild(row);
}

// ── Table ──
function buildTable() {
  var wrap=$('tableWrap');
  var rows=getFilteredRows();
  var cols=state.activeCols;

  var html='<table><thead><tr>';
  for (var ti=0;ti<cols.length;ti++){
    var arrow=state.tableSort.col===cols[ti]?(state.tableSort.asc?'\\u25b2':'\\u25bc'):'';
    html+='<th data-col="'+escHtml(cols[ti])+'">'+escHtml(cols[ti])+'<span class="arrow">'+arrow+'</span></th>';
  }
  html+='</tr></thead><tbody>';

  var sorted=rows.slice();
  if (state.tableSort.col) {
    var sc=state.tableSort.col;var asc=state.tableSort.asc;
    sorted.sort(function(a,b){
      var va=a[sc], vb=b[sc];
      if (va==null) return 1;
      if (vb==null) return -1;
      if (typeof va==='number'&&typeof vb==='number') return asc?va-vb:vb-va;
      return asc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));
    });
  }

  for (var ri=0;ri<sorted.length;ri++){
    html+='<tr>';
    for (var ci2=0;ci2<cols.length;ci2++){
      var v=sorted[ri][cols[ci2]];
      if (v===null||v===undefined||v==='') html+='<td class="null-val">null</td>';
      else html+='<td title="'+escHtml(String(v))+'">'+escHtml(String(v))+'</td>';
    }
    html+='</tr>';
  }
  html+='</tbody></table>';
  wrap.innerHTML=html;

  var ths=wrap.querySelectorAll('th');
  for(var hi=0;hi<ths.length;hi++){
    ths[hi].addEventListener('click',(function(col){return function(){
      if (state.tableSort.col===col) state.tableSort.asc=!state.tableSort.asc;
      else { state.tableSort.col=col; state.tableSort.asc=true; }
      buildTable();
    };})(ths[hi].getAttribute('data-col')));
  }
}

// ── Export ──
function downloadFile(name, content, type) {
  var blob=new Blob([content],{type:type});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function exportCSV() {
  var rows=getFilteredRows();
  var cols=state.activeCols;
  var csv=cols.map(function(c){return '"'+c.replace(/"/g,'""')+'"';}).join(',')+'\\n';
  for (var i=0;i<rows.length;i++){
    csv+=cols.map(function(c){
      var v=rows[i][c];
      if (v===null||v===undefined) return '';
      return '"'+String(v).replace(/"/g,'""')+'"';
    }).join(',')+'\\n';
  }
  downloadFile('dataset-export.csv',csv,'text/csv');
}

function exportJSON() {
  var rows=getFilteredRows();
  var cols=state.activeCols;
  var data=rows.map(function(r){var o={};for(var i=0;i<cols.length;i++)o[cols[i]]=r[cols[i]];return o;});
  downloadFile('dataset-export.json',JSON.stringify(data,null,2),'application/json');
}

// ── Events ──
$('btnChart').addEventListener('click',function(){
  state.view='chart';
  $('btnChart').classList.add('active');$('btnTable').classList.remove('active');
  $('chartWrap').style.display='block';$('tableWrap').style.display='none';
  setTimeout(function(){if(chart)chart.resize();},50);
});
$('btnTable').addEventListener('click',function(){
  state.view='table';
  $('btnTable').classList.add('active');$('btnChart').classList.remove('active');
  $('chartWrap').style.display='none';$('tableWrap').style.display='flex';
  buildTable();
});

$('chartType').addEventListener('change',function(){state.chartType=this.value;render();});
$('xAxis').addEventListener('change',function(){state.xAxis=this.value;render();});
$('yAxis').addEventListener('change',function(){state.yAxis=this.value;render();});
$('groupBy').addEventListener('change',function(){state.groupBy=this.value;render();});

$('rowStart').addEventListener('change',function(){state.rowStart=Math.max(0,parseInt(this.value)||0);render();if(state.view==='table')buildTable();});
$('rowEnd').addEventListener('change',function(){state.rowEnd=Math.min(ROWS.length,parseInt(this.value)||ROWS.length);render();if(state.view==='table')buildTable();});

$('addFilterBtn').addEventListener('click',function(){buildFilter();});

$('exportBtn').addEventListener('click',function(e){e.stopPropagation();$('exportDropdown').classList.toggle('show');});
document.addEventListener('click',function(){$('exportDropdown').classList.remove('show');});
$('expPng').addEventListener('click',function(){
  if(!chart)return;
  var url=chart.getDataURL({type:'png',pixelRatio:2,backgroundColor:'#0f1117'});
  var a=document.createElement('a');a.href=url;a.download='chart.png';document.body.appendChild(a);a.click();document.body.removeChild(a);
});
$('expSvg').addEventListener('click',function(){
  if(!chart)return;
  var tmp=document.createElement('div');
  tmp.style.cssText='position:absolute;left:-9999px;width:'+chartDom.offsetWidth+'px;height:'+chartDom.offsetHeight+'px';
  document.body.appendChild(tmp);
  var svgChart=echarts.init(tmp,'dark',{renderer:'svg'});
  svgChart.setOption(chart.getOption());
  var svgEl=tmp.querySelector('svg');
  if(svgEl)downloadFile('chart.svg',svgEl.outerHTML,'image/svg+xml');
  svgChart.dispose();
  tmp.remove();
});
$('expCsv').addEventListener('click',function(){exportCSV();});
$('expJson').addEventListener('click',function(){exportJSON();});

// ── Init ──
function init() {
  try {
    $('rowEnd').value=ROWS.length;
    state.rowEnd=ROWS.length;
    buildColList();
    buildAxisSelectors();
    if (COLS.length>0) {
      var firstReal=null;
      for(var i=0;i<COLS.length;i++){if(COLS[i].name&&COLS[i].name.length>0){firstReal=COLS[i];break;}}
      if (firstReal) { state.xAxis=firstReal.name; $('xAxis').value=firstReal.name; }
    }
    render();
    setTimeout(function(){if(chart)chart.resize();render();},200);
  } catch(e) {
    console.error('Init error:', e);
  }
}

if (document.readyState==='complete') { init(); }
else { window.addEventListener('load', init); }

})();
<\/script>
</body>
</html>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
