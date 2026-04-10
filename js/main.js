let rawData = [];
let scatterplot, parallelCoords, timeline, bubbleChart, donutChart;

// 加载数据
d3.csv('data/tracks.csv').then(data => {
    // 数据预处理
    rawData = data.map(d => ({
        id: d.id,
        name: d.name,
        popularity: +d.popularity,
        duration_ms: +d.duration_ms,
        explicit: +d.explicit,
        artists: d.artists.replace(/[\[\]']/g, ''),
        release_date: d.release_date,
        year: d.release_date.length === 4
            ? +d.release_date
            : new Date(d.release_date).getFullYear(),
        danceability: +d.danceability,
        energy: +d.energy,
        key: +d.key,
        loudness: +d.loudness,
        mode: +d.mode,
        speechiness: +d.speechiness,
        acousticness: +d.acousticness,
        instrumentalness: +d.instrumentalness,
        liveness: +d.liveness,
        valence: +d.valence,
        tempo: +d.tempo / 200, 
        time_signature: +d.time_signature
    })).filter(d => !isNaN(d.year) && d.year >= 1922 && d.year <= 2020);

    const initialSample = d3.shuffle([...rawData]).slice(0, 5000);

    // 初始化可视化
    // 初始化可视化（增加安全校验，防止缺失文件导致全站崩溃）
    if (typeof Scatterplot !== 'undefined') scatterplot = new Scatterplot('#scatterplot', initialSample);
    if (typeof ParallelCoordinates !== 'undefined') parallelCoords = new ParallelCoordinates('#parallel-coords', initialSample);
    if (typeof Timeline !== 'undefined') timeline = new Timeline('#timeline', initialSample);
    if (typeof BubbleChart !== 'undefined') bubbleChart = new BubbleChart('#bar-chart', initialSample);
    if (typeof DonutChart !== 'undefined') donutChart = new DonutChart('#donut-chart', initialSample);

    setupEventListeners();

    document.getElementById('visible-count').textContent = initialSample.length;
    document.getElementById('selected-count').textContent = 0;
});

function setupEventListeners() {
    const yearStart = document.getElementById('year-start');
    const yearEnd   = document.getElementById('year-end');
    const yearRange = document.getElementById('year-range');

    function updateYearFilter() {
        let start = +yearStart.value;
        let end   = +yearEnd.value;
        yearRange.textContent = `${start} - ${end}`;
        applyFilters();
    }

    yearStart.addEventListener('change', () => {
        if (+yearStart.value > +yearEnd.value) yearStart.value = yearEnd.value;
        updateYearFilter();
    });
    
    yearEnd.addEventListener('change', () => {
        if (+yearEnd.value < +yearStart.value) yearEnd.value = yearStart.value;
        updateYearFilter();
    });

    const popFilterInput = document.getElementById('popularity-filter');
    const popularityValue = document.getElementById('popularity-value');
    
    popFilterInput.addEventListener('input', function() {
        popularityValue.textContent = this.value;
        applyFilters();
    });

    const sampleSizeInput = document.getElementById('sample-size');
    const sampleCountSpan = document.getElementById('sample-count');
    document.getElementById('sample-minus').addEventListener('click', () => {
        let val = Math.max(100, parseInt(sampleSizeInput.value) - 500);
        sampleSizeInput.value = val;
        sampleCountSpan.textContent = val;
        applyFilters();
    });
    document.getElementById('sample-plus').addEventListener('click', () => {
        let val = Math.min(10000, parseInt(sampleSizeInput.value) + 500);
        sampleSizeInput.value = val;
        sampleCountSpan.textContent = val;
        applyFilters();
    });

    document.getElementById('x-axis').addEventListener('change', function () {
        scatterplot.updateAxes(this.value, scatterplot.yAttr);
    });
    document.getElementById('y-axis').addEventListener('change', function () {
        scatterplot.updateAxes(scatterplot.xAttr, this.value);
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        yearStart.value = 1922;
        yearEnd.value = 2020;
        popFilterInput.value = 0;
        popularityValue.textContent = "0";
        sampleSizeInput.value = 5000;
        sampleCountSpan.textContent = "5000";
        yearRange.textContent = '1922 - 2020';
        applyFilters();
    });

    document.querySelector('.close-btn').addEventListener('click', () => {
        document.getElementById('detail-panel').classList.add('hidden');
    });

    window.addEventListener('selectionChanged', (e) => {
        if (parallelCoords) parallelCoords.highlightData(e.detail);
        document.getElementById('selected-count').textContent = e.detail.length;
        updateDataTable(e.detail);
    });

    window.addEventListener('parallelSelection', (e) => {
        if (scatterplot) scatterplot.highlightData(e.detail);
        document.getElementById('selected-count').textContent = e.detail.length;
        updateDataTable(e.detail);
    });
}

function applyFilters() {
    const yearStart = +document.getElementById('year-start').value;
    const yearEnd = +document.getElementById('year-end').value;
    const minPopularity = +document.getElementById('popularity-filter').value;
    const maxSamples = +document.getElementById('sample-size').value;

    let filtered = rawData.filter(d =>
        d.year >= yearStart &&
        d.year <= yearEnd &&
        d.popularity >= minPopularity
    );

    if (filtered.length > maxSamples) {
        filtered = d3.shuffle([...filtered]).slice(0, maxSamples);
    }

    // 更新各个图表（增加防护判定）
    if (scatterplot) scatterplot.updateData(filtered);
    if (parallelCoords) parallelCoords.updateData(filtered);
    if (timeline) timeline.updateData(filtered);
    if (bubbleChart) bubbleChart.updateData(filtered);
    if (donutChart) donutChart.updateData(filtered);

    document.getElementById('visible-count').textContent = filtered.length;
    document.getElementById('selected-count').textContent = 0;
    
    updateDataTable([]);
}

function updateDataTable(selectedData) {
    const tableContainer = document.getElementById('table-container');
    const tbody = d3.select('#track-table-body');
    const warning = document.getElementById('table-warning');
    
    if (!selectedData || selectedData.length === 0) {
        tableContainer.style.display = 'none';
        return;
    }

    tableContainer.style.display = 'block';
    document.getElementById('table-count').textContent = selectedData.length;

    selectedData.sort((a, b) => b.popularity - a.popularity);
    
    let displayData = selectedData;
    if (selectedData.length > 100) {
        displayData = selectedData.slice(0, 100);
        warning.textContent = "（为保证流畅，仅显示前 100 条）";
    } else {
        warning.textContent = "";
    }

    const rows = tbody.selectAll('tr').data(displayData, d => d.id);
    rows.exit().remove();

    const rowsEnter = rows.enter().append('tr')
        .style('border-bottom', '1px solid #eee')
        .style('cursor', 'pointer')
        .on('mouseover', function() { d3.select(this).style('background', '#f0faf4'); })
        .on('mouseout', function() { d3.select(this).style('background', 'transparent'); })
        .on('click', (event, d) => scatterplot.showDetail(d));

    rowsEnter.append('td').style('padding', '8px 10px').style('font-weight', '600').text(d => d.name);
    rowsEnter.append('td').style('padding', '8px 10px').style('color', '#636e72').text(d => d.artists);
    rowsEnter.append('td').style('padding', '8px 10px').text(d => d.year);
    rowsEnter.append('td').style('padding', '8px 10px').text(d => d.popularity);

    rowsEnter.merge(rows);
}

// ====== 歌曲特征雷达图绘制函数 ======
function drawRadarChart(containerId, data) {
    // 先清空之前的图表
    d3.select(containerId).selectAll('svg').remove();

    const width = 250;
    const height = 250;
    const radius = Math.min(width, height) / 2 - 30;

    const svg = d3.select(containerId).append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);

    // 需要展示的音乐特征维度（确保里面有 'instrumentalness'）
    const features = ['danceability', 'energy', 'valence', 'acousticness', 'speechiness', 'instrumentalness'];
    
    // 对应的中文标签
    const labels = {
        'danceability': '舞蹈性', 'energy': '能量', 'valence': '情绪',
        'acousticness': '声学性', 'speechiness': '语音性', 'instrumentalness': '器乐性'
    };

    const angleSlice = Math.PI * 2 / features.length;
    const rScale = d3.scaleLinear().range([0, radius]).domain([0, 1]);

    // 1. 画背景网格（雷达圈）
    const levels = 4;
    for (let i = 1; i <= levels; i++) {
        const r = radius / levels * i;
        svg.append('circle')
            .attr('r', r)
            .style('fill', 'none')
            .style('stroke', '#dfe6e9')
            .style('stroke-dasharray', '3,3');
    }

    // 2. 画轴线
    const axis = svg.selectAll('.axis')
        .data(features).enter()
        .append('g').attr('class', 'axis');

    axis.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', (d, i) => rScale(1) * Math.cos(angleSlice * i - Math.PI / 2))
        .attr('y2', (d, i) => rScale(1) * Math.sin(angleSlice * i - Math.PI / 2))
        .style('stroke', '#dfe6e9')
        .style('stroke-width', '1px');

    // 3. 画标签文字
    axis.append('text')
        .attr('class', 'legend')
        .style('font-size', '11px')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('x', (d, i) => rScale(1.25) * Math.cos(angleSlice * i - Math.PI / 2))
        .attr('y', (d, i) => rScale(1.25) * Math.sin(angleSlice * i - Math.PI / 2))
        .text(d => labels[d])
        .style('fill', '#636e72');

    // 4. 组装数据并画雷达图的多边形
    const chartData = features.map(f => ({ axis: f, value: +data[f] || 0 }));
    
    const radarLine = d3.lineRadial()
        .angle((d, i) => i * angleSlice)
        .radius(d => rScale(d.value))
        .curve(d3.curveLinearClosed);

    svg.append('path')
        .datum(chartData)
        .attr('d', radarLine)
        .style('fill', '#1DB954') // Spotify 的绿色
        .style('fill-opacity', 0.4)
        .style('stroke', '#1DB954')
        .style('stroke-width', 2);

    // 5. 画多边形上的数据点
    svg.selectAll('.radarCircle')
        .data(chartData).enter()
        .append('circle').attr('class', 'radarCircle')
        .attr('r', 3)
        .attr('cx', (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2))
        .attr('cy', (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2))
        .style('fill', '#fff')
        .style('stroke', '#1DB954')
        .style('stroke-width', 2);
}