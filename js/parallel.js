class ParallelCoordinates {
    constructor(containerId, data) {
        this.container = d3.select(containerId);
        this.data = data;
        this.filteredData = data;

        this.margin = { top: 40, right: 10, bottom: 10, left: 10 };
        this.width = 560 - this.margin.left - this.margin.right;
        this.height = 400 - this.margin.top - this.margin.bottom;

        this.dimensions = ['danceability', 'energy', 'speechiness',
            'acousticness', 'instrumentalness', 'valence', 'tempo'];

        // 存储每个轴的brush范围
        this.brushSelections = {};

        this.init();
    }

    init() {
        this.svg = this.container.append('svg')
            .attr('width', this.width + this.margin.left + this.margin.right)
            .attr('height', this.height + this.margin.top + this.margin.bottom)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scalePoint()
            .domain(this.dimensions)
            .range([0, this.width])
            .padding(0.2);

        this.yScales = {};
        this.dimensions.forEach(dim => {
            this.yScales[dim] = d3.scaleLinear()
                .domain(d3.extent(this.data, d => d[dim]))
                .range([this.height, 0]);
        });

        this.line = d3.line();

        this.render();
    }

    render() {
        // 清除所有旧内容，重新绘制
        this.svg.selectAll('*').remove();

        // 背景线（灰色，全量数据轮廓）
        this.svg.append('g')
            .attr('class', 'background-lines')
            .selectAll('path')
            .data(this.filteredData)
            .enter().append('path')
            .attr('class', 'line background-line')
            .attr('d', d => this.path(d))
            .style('stroke', '#b2bec3')
            .style('stroke-width', '1px')
            .style('opacity', 0.15)
            .style('fill', 'none');

        // 前景线（彩色）
        this.svg.append('g')
            .attr('class', 'foreground-lines')
            .selectAll('path')
            .data(this.filteredData)
            .enter().append('path')
            .attr('class', 'foreground-line')
            .attr('d', d => this.path(d))
            .style('stroke', d => d3.interpolateViridis((d.year - 1922) / (2020 - 1922)))
            .style('stroke-width', '1.2px')
            .style('opacity', 0.4)
            .style('fill', 'none');

        // 绘制坐标轴 + brush
        const self = this; // 保存正确的this引用

        this.dimensions.forEach(dim => {
            const x = this.xScale(dim);

            const axisG = this.svg.append('g')
                .attr('class', 'dimension')
                .attr('transform', `translate(${x},0)`);

            // 坐标轴
            axisG.append('g')
                .attr('class', 'axis')
                .call(d3.axisLeft(this.yScales[dim]).ticks(5));

            // 轴标签
            axisG.append('text')
                .style('text-anchor', 'middle')
                .attr('y', -12)
                .text(this.getDimensionLabel(dim))
                .style('fill', '#2d3436')
                .style('font-weight', '600')
                .style('font-size', '11px');

            // 修复2：brush正确绑定，用闭包变量dim避免this丢失
            const brushG = axisG.append('g').attr('class', 'brush');

            const brush = d3.brushY()
                .extent([[-10, 0], [10, self.height]])
                .on('brush end', function () {
                    // 用闭包self和dim，完全避免this歧义
                    const sel = d3.brushSelection(this);
                    if (sel) {
                        self.brushSelections[dim] = sel;
                    } else {
                        delete self.brushSelections[dim];
                    }
                    self.applyBrush();
                });

            brushG.call(brush);
        });
    }

    // 修复2：统一处理所有轴的brush，正确变暗未选中线条
    applyBrush() {
        const self = this;
        const activeDims = Object.keys(this.brushSelections);

        if (activeDims.length === 0) {
            // 没有任何brush激活，全部恢复
            this.svg.selectAll('.foreground-line')
                .style('opacity', 0.4)
                .style('stroke-width', '1.2px');

            window.dispatchEvent(new CustomEvent('parallelSelection',
                { detail: this.filteredData }));
            return;
        }

        const selected = this.filteredData.filter(d => {
            return activeDims.every(dim => {
                const [py0, py1] = self.brushSelections[dim];
                // brushY范围是像素，需用invert转回数据值
                const v0 = self.yScales[dim].invert(py0); // 上边（大值）
                const v1 = self.yScales[dim].invert(py1); // 下边（小值）
                const lo = Math.min(v0, v1);
                const hi = Math.max(v0, v1);
                return d[dim] >= lo && d[dim] <= hi;
            });
        });

        const selectedSet = new Set(selected.map((_, i) => i));

        // 修复2：选中的线高亮，未选中的变为几乎透明
        this.svg.selectAll('.foreground-line')
            .style('opacity', (d, i) => selected.includes(d) ? 0.9 : 0.05)
            .style('stroke-width', (d, i) => selected.includes(d) ? '2px' : '1px');

        window.dispatchEvent(new CustomEvent('parallelSelection',
            { detail: selected }));
    }

    path(d) {
        return this.line(this.dimensions.map(dim => {
            return [this.xScale(dim), this.yScales[dim](d[dim])];
        }));
    }

    updateData(data) {
        this.filteredData = data;
        this.brushSelections = {}; // 数据更新时清除brush状态
        this.render();
    }

    highlightData(data) {
        this.svg.selectAll('.foreground-line')
            .style('opacity', d => data.includes(d) ? 0.9 : 0.05)
            .style('stroke-width', d => data.includes(d) ? '2px' : '1px');
    }

    getDimensionLabel(dim) {
        const labels = {
            'danceability': '舞蹈性',
            'energy': '能量',
            'speechiness': '语音性',
            'acousticness': '声学性',
            'instrumentalness': '器乐性',
            'valence': '情绪',
            'tempo': '节奏'
        };
        return labels[dim] || dim;
    }
}