class Scatterplot {
    constructor(containerId, data) {
        this.container = d3.select(containerId);
        this.data = data;
        this.filteredData = data;
        this.selectedData = [];

        this.margin = { top: 20, right: 90, bottom: 50, left: 60 };
        this.width = 600 - this.margin.left - this.margin.right;
        this.height = 400 - this.margin.top - this.margin.bottom;

        this.xAttr = 'energy';
        this.yAttr = 'valence';

        this.init();
    }

    init() {
        this.svg = this.container.append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        const defs = this.svg.append('defs');
        const grad = defs.append('linearGradient')
            .attr('id', 'year-gradient')
            .attr('x1', '0%').attr('x2', '0%')
            .attr('y1', '0%').attr('y2', '100%');

        [
            { offset: '0%',   color: d3.interpolateViridis(1.0) },
            { offset: '25%',  color: d3.interpolateViridis(0.75) },
            { offset: '50%',  color: d3.interpolateViridis(0.5) },
            { offset: '75%',  color: d3.interpolateViridis(0.25) },
            { offset: '100%', color: d3.interpolateViridis(0.0) },
        ].forEach(s => grad.append('stop').attr('offset', s.offset).attr('stop-color', s.color));

        this.brush = d3.brush()
            .extent([[0, 0], [this.width, this.height]])
            .on('end', (event) => this.brushed(event));

        this.brushG = this.svg.append('g').attr('class', 'brush').call(this.brush);

        this.xAxisG = this.svg.append('g').attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${this.height})`);
        this.yAxisG = this.svg.append('g').attr('class', 'axis y-axis');

        this.xLabel = this.svg.append('text').attr('class', 'axis-label')
            .attr('text-anchor', 'middle').attr('x', this.width / 2).attr('y', this.height + 40)
            .style('font-size', '13px').style('fill', '#2d3436');

        this.yLabel = this.svg.append('text').attr('class', 'axis-label')
            .attr('text-anchor', 'middle').attr('transform', 'rotate(-90)')
            .attr('y', -45).attr('x', -this.height / 2)
            .style('font-size', '13px').style('fill', '#2d3436');

        const cbX = this.width + 20;
        const cbW = 14;
        const cbH = this.height;

        this.svg.append('rect')
            .attr('x', cbX).attr('y', 0)
            .attr('width', cbW).attr('height', cbH)
            .attr('rx', 3)
            .style('fill', 'url(#year-gradient)');

        this.colorBarAxis = this.svg.append('g')
            .attr('transform', `translate(${cbX + cbW}, 0)`);


        this.tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(25,20,20,0.9)')
            .style('color', 'white')
            .style('padding', '10px 14px')
            .style('border-radius', '8px')
            .style('pointer-events', 'none')
            .style('font-size', '13px')
            .style('line-height', '1.6')
            .style('opacity', 0);

        this.render();
    }

    updateAxes(xAttr, yAttr) {
        this.xAttr = xAttr;
        this.yAttr = yAttr;
        this.render();
    }

    render() {
        if (this.filteredData.length === 0) return;

        const yearMin = d3.min(this.filteredData, d => d.year);
        const yearMax = d3.max(this.filteredData, d => d.year);

        const xScale = d3.scaleLinear()
            .domain([0, d3.max(this.filteredData, d => d[this.xAttr]) || 1])
            .range([0, this.width]).nice();

        const yScale = d3.scaleLinear()
            .domain([0, d3.max(this.filteredData, d => d[this.yAttr]) || 1])
            .range([this.height, 0]).nice();

        const colorScale = d3.scaleSequential(d3.interpolateViridis)
            .domain([yearMin, yearMax]);

        this.xScale = xScale;
        this.yScale = yScale;

        this.xAxisG.transition().duration(500).call(d3.axisBottom(xScale).ticks(5));
        this.yAxisG.transition().duration(500).call(d3.axisLeft(yScale).ticks(5));
        this.xLabel.text(this.getAxisLabel(this.xAttr));
        this.yLabel.text(this.getAxisLabel(this.yAttr));

        const cbScale = d3.scaleLinear()
            .domain([yearMax, yearMin])
            .range([0, this.height]);

        this.colorBarAxis.call(
            d3.axisRight(cbScale).ticks(5).tickFormat(d3.format('d')).tickSize(4)
        );
        this.colorBarAxis.selectAll('text').style('font-size', '10px').style('fill', '#636e72');
        this.colorBarAxis.select('.domain').remove();

        const dots = this.svg.selectAll('.dot').data(this.filteredData, d => d.id);

        dots.exit().transition().duration(300).attr('r', 0).remove();

        const dotsEnter = dots.enter()
            .append('circle').attr('class', 'dot').attr('r', 0)
            .attr('cx', d => xScale(d[this.xAttr]))
            .attr('cy', d => yScale(d[this.yAttr]))
            .on('mouseover', (event, d) => this.showTooltip(event, d))
            .on('mouseout', () => this.hideTooltip())
            .on('click', (event, d) => this.showDetail(d));

        dots.merge(dotsEnter).transition().duration(500)
            .attr('r', 4)
            .attr('cx', d => xScale(d[this.xAttr]))
            .attr('cy', d => yScale(d[this.yAttr]))
            .style('fill', d => colorScale(d.year))
            .style('opacity', 0.6);
    }

    brushed(event) {
        const selection = event.selection;
        if (!selection) {
            this.selectedData = [];
            this.highlightData([]);
            window.dispatchEvent(new CustomEvent('selectionChanged', { detail: [] }));
            return;
        }
        const [[x0, y0], [x1, y1]] = selection;
        this.selectedData = this.filteredData.filter(d => {
            const x = this.xScale(d[this.xAttr]);
            const y = this.yScale(d[this.yAttr]);
            return x >= x0 && x <= x1 && y >= y0 && y <= y1;
        });
        
        this.highlightData(this.selectedData);
        window.dispatchEvent(new CustomEvent('selectionChanged', { detail: this.selectedData }));
    }

    updateData(data) {
        this.filteredData = data;
        this.selectedData = [];
        this.brushG.call(this.brush.move, null);
        this.render();
    }

    // 【修改核心】将未选中的点设为浅灰（#ced6e0），适度增加透明度使其可见但不刺眼
    highlightData(data) {
        const isSelected = data.length > 0;
        
        this.svg.selectAll('.dot')
            .classed('selected', d => data.includes(d))
            .style('opacity', d => isSelected ? (data.includes(d) ? 1 : 0.4) : 0.6)
            .style('fill', d => isSelected ? (data.includes(d) ? '#ff4757' : '#ced6e0') : '#ced6e0')
            .style('stroke-width', d => isSelected && data.includes(d) ? '1px' : '0px')
            .style('stroke', d => isSelected && data.includes(d) ? '#fff' : null);

        // 置顶渲染，防遮挡
        if (isSelected) {
            this.svg.selectAll('.dot')
                .filter(d => data.includes(d))
                .raise();
        }
    }

    showTooltip(event, d) {
        this.tooltip.transition().duration(150).style('opacity', 1);
        this.tooltip.html(`
            <strong>${d.name || '未知'}</strong><br/>
            艺术家: ${d.artists || '—'}<br/>
            年份: ${d.year}<br/>
            流行度: ${d.popularity}<br/>
            ${this.getAxisLabel(this.xAttr)}: ${(+d[this.xAttr]).toFixed(3)}<br/>
            ${this.getAxisLabel(this.yAttr)}: ${(+d[this.yAttr]).toFixed(3)}
        `)
        .style('left', (event.pageX + 14) + 'px')
        .style('top', (event.pageY - 32) + 'px');
    }

    hideTooltip() {
        this.tooltip.transition().duration(300).style('opacity', 0);
    }

    showDetail(d) {
        const panel = document.getElementById('detail-panel');
        document.getElementById('detail-title').textContent = d.name || '未知歌曲';
        document.getElementById('detail-content').innerHTML = `
            <p><strong>艺术家：</strong>${d.artists}</p>
            <p><strong>发行日期：</strong>${d.release_date}</p>
            <p><strong>流行度：</strong>${d.popularity}</p>
            <p><strong>时长：</strong>${Math.floor(d.duration_ms / 60000)}:${String(Math.floor((d.duration_ms % 60000) / 1000)).padStart(2, '0')}</p>
            <hr>
            <p><strong>舞蹈性：</strong>${(+d.danceability).toFixed(3)}</p>
            <p><strong>能量：</strong>${(+d.energy).toFixed(3)}</p>
            <p><strong>情绪：</strong>${(+d.valence).toFixed(3)}</p>
            <p><strong>声学性：</strong>${(+d.acousticness).toFixed(3)}</p>
            <p><strong>节奏：</strong>${(+d.tempo).toFixed(3)}</p>
            <p><strong>器乐性：</strong>${(+d.instrumentalness).toFixed(3)}</p>
            <p><strong>语音性：</strong>${(+d.speechiness).toFixed(3)}</p>
        `;
        
        if (typeof drawRadarChart === 'function') {
            drawRadarChart('#radar-chart-container', d);
        }
        
        panel.classList.remove('hidden');
    }

    getAxisLabel(attr) {
        const labels = {
            'danceability': '舞蹈性', 'energy': '能量', 'valence': '情绪',
            'tempo': '节奏', 'acousticness': '声学性',
            'speechiness': '语音性', 'instrumentalness': '器乐性'
        };
        return labels[attr] || attr;
    }
}