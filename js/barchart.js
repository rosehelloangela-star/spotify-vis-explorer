class BarChart {
    constructor(containerId, data) {
        this.container = d3.select(containerId);
        this.margin = { top: 30, right: 40, bottom: 30, left: 140 }; // 优化了边距
        this.width = 450 - this.margin.left - this.margin.right;
        this.height = 320 - this.margin.top - this.margin.bottom;
        this.init();
        this.updateData(data);
    }

    init() {
        this.svg = this.container.append('svg')
            .attr('width', '100%')
            .attr('viewBox', `0 0 ${this.width + this.margin.left + this.margin.right} ${this.height + this.margin.top + this.margin.bottom}`)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        // === 核心魔法：定义发光滤镜 (Glow Filter) ===
        const defs = this.svg.append('defs');
        const filter = defs.append('filter').attr('id', 'glow');
        filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
        const feMerge = filter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

        // 背景网格容器
        this.gridG = this.svg.append('g').attr('class', 'grid');
        this.xAxisG = this.svg.append('g').attr('transform', `translate(0,${this.height})`);
        this.yAxisG = this.svg.append('g');
    }

    updateData(data) {
        if (!data || data.length === 0) {
            this.svg.selectAll('.lollipop-group').remove();
            this.gridG.selectAll('*').remove();
            return;
        }

        const artistCounts = d3.rollup(data, v => v.length, d => d.artists);
        let topArtists = Array.from(artistCounts, ([artist, count]) => ({ artist, count }))
            .sort((a, b) => d3.descending(a.count, b.count))
            .slice(0, 10);
        
        topArtists = topArtists.reverse();

        const xScale = d3.scaleLinear()
            .domain([0, d3.max(topArtists, d => d.count)])
            .range([0, this.width])
            .nice();

        const yScale = d3.scaleBand()
            .domain(topArtists.map(d => d.artist))
            .range([this.height, 0])
            .padding(1);

        // === 绘制高级感虚线网格 ===
        this.gridG.transition().duration(500)
            .call(d3.axisBottom(xScale)
                .ticks(5)
                .tickSize(this.height)
                .tickFormat('')
            )
            .selectAll('line')
            .style('stroke', '#f1f2f6')
            .style('stroke-dasharray', '4,4');
        this.gridG.select('.domain').remove();

        // === 优化 X/Y 轴样式 ===
        this.xAxisG.transition().duration(500).call(d3.axisBottom(xScale).ticks(5))
            .selectAll('text').style('fill', '#a4b0be').style('font-size', '11px');
        this.xAxisG.selectAll('line').style('stroke', '#dfe4ea');
        this.xAxisG.select('.domain').style('stroke', '#dfe4ea');

        this.yAxisG.transition().duration(500).call(d3.axisLeft(yScale).tickSize(0))
            .selectAll("text")
            .style("font-size", "12px")
            .style("fill", "#2d3436")
            .style('font-weight', '500');
        this.yAxisG.select('.domain').remove();

        // === 为每一行建立一个 Group，方便统一管理动画和交互 ===
        const groups = this.svg.selectAll('.lollipop-group').data(topArtists, d => d.artist);
        groups.exit().transition().duration(300).style('opacity', 0).remove();

        const groupsEnter = groups.enter().append('g')
            .attr('class', 'lollipop-group')
            .attr('transform', d => `translate(0, ${yScale(d.artist)})`);

        // 隐形的矩形，用来增加 hover 的感应面积（体验极佳）
        groupsEnter.append('rect')
            .attr('height', 20)
            .attr('width', this.width + 100) // 向左延伸一点包含文字
            .attr('x', -100)
            .attr('y', -10)
            .attr('fill', 'transparent')
            .style('cursor', 'pointer')
            .on('mouseover', function() {
                const parent = d3.select(this.parentNode);
                parent.select('.lolli-circle').transition().duration(200).attr('r', 8).style('filter', 'url(#glow)');
                parent.select('.lolli-line').transition().duration(200).style('stroke-width', '3px').style('stroke', '#1DB954');
                parent.select('.lolli-text').transition().duration(200).style('fill', '#1DB954').style('font-size', '12px');
            })
            .on('mouseout', function() {
                const parent = d3.select(this.parentNode);
                parent.select('.lolli-circle').transition().duration(200).attr('r', 5).style('filter', 'none');
                parent.select('.lolli-line').transition().duration(200).style('stroke-width', '2px').style('stroke', '#dfe6e9');
                parent.select('.lolli-text').transition().duration(200).style('fill', '#636e72').style('font-size', '11px');
            });

        // 棒子（线条）
        groupsEnter.append('line')
            .attr('class', 'lolli-line')
            .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 0)
            .style('stroke', '#dfe6e9')
            .style('stroke-width', '2px')
            .style('stroke-linecap', 'round');

        // 糖（圆点）
        groupsEnter.append('circle')
            .attr('class', 'lolli-circle')
            .attr('cx', 0).attr('cy', 0).attr('r', 0)
            .style('fill', '#1DB954') // Spotify 主题绿
            .style('stroke', '#ffffff')
            .style('stroke-width', '2px');

        // 数字标签
        groupsEnter.append('text')
            .attr('class', 'lolli-text')
            .attr('x', 0).attr('y', 4)
            .style('font-size', '11px')
            .style('fill', '#636e72')
            .style('font-weight', '600')
            .style('opacity', 0);

        // === 更新与动画：交错出场效果 ===
        const groupsMerge = groupsEnter.merge(groups);
        
        groupsMerge.transition().duration(500)
            .attr('transform', d => `translate(0, ${yScale(d.artist)})`);

        groupsMerge.select('.lolli-line').transition().duration(600)
            .attr('x2', d => xScale(d.count));

        // delay((d, i) => i * 40) 会让数据像阶梯一样一个一个蹦出来
        groupsMerge.select('.lolli-circle')
        .transition().duration(600).delay((d, i) => i * 30)  // was (10-i)*40
        .attr('cx', d => xScale(d.count)).attr('r', 5);

        groupsMerge.select('.lolli-text')
        .transition().duration(600).delay((d, i) => i * 30)  // was (10-i)*40
        .attr('x', d => xScale(d.count) + 12)
        .style('opacity', 1)
        .text(d => d.count > 0 ? d.count : '');
    }
}