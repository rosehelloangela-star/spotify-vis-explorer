class DonutChart {
    constructor(containerId, data) {
        this.container = d3.select(containerId);
        this.width = 400;
        this.height = 300;
        // ↑ 改小一点，避免超出父容器被裁切
        this.radius = Math.min(this.width, this.height) / 2 - 80;
        // ↑ 留更多空间给外部标签
        this.init();
        this.updateData(data);
    }

    init() {
        this.svg = this.container.append('svg')
            .attr('width', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .append('g')
            .attr('transform', `translate(${this.width / 2},${this.height / 2})`);

        this.color = d3.scaleOrdinal()
            .domain(['大调 (Major)', '小调 (Minor)'])
            .range(['#1DB954', '#535c68']);

        this.pie = d3.pie().value(d => d.count).sort(null);
        this.arc = d3.arc()
            .innerRadius(this.radius * 0.5)
            .outerRadius(this.radius);
        this.hoverArc = d3.arc()
            .innerRadius(this.radius * 0.5)
            .outerRadius(this.radius + 8);
        // 用于计算外部标签位置
        this.outerArc = d3.arc()
            .innerRadius(this.radius * 1.2)
            .outerRadius(this.radius * 1.2);

        this.centerText = this.svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '-0.1em')
            .style('font-size', '20px')
            .style('font-weight', 'bold')
            .style('fill', '#2d3436');

        this.centerSubText = this.svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '1.2em')
            .style('font-size', '11px')
            .style('fill', '#636e72');
    }

    updateData(data) {
        this.svg.selectAll('.arc-group').remove();
        this.svg.selectAll('.label-line').remove();
        this.svg.selectAll('.label-text').remove();

        if (!data || data.length === 0) {
            this.centerText.text('0');
            this.centerSubText.text('首歌曲');
            return;
        }

        const counts = d3.rollup(data, v => v.length, d => d.mode);
        const pieData = [
            { label: '大调', count: counts.get(1) || 0 },
            { label: '小调', count: counts.get(0) || 0 }
        ];

        this.centerText.text(data.length);
        this.centerSubText.text('首歌曲');

        const arcs = this.svg.selectAll('.arc-group')
            .data(this.pie(pieData))
            .enter().append('g')
            .attr('class', 'arc-group');

        arcs.append('path')
            .attr('d', this.arc)
            .attr('fill', d => this.color(d.data.label))
            .attr('stroke', 'white')
            .style('stroke-width', '2px')
            .style('cursor', 'pointer')
            .on('mouseover', (event) => {
                d3.select(event.currentTarget)
                    .transition().duration(200)
                    .attr('d', this.hoverArc);
            })
            .on('mouseout', (event) => {
                d3.select(event.currentTarget)
                    .transition().duration(200)
                    .attr('d', this.arc);
            });

        // 外部标签：引线 + 文字
        const self = this;
        arcs.each(function(d) {
            if (d.data.count === 0) return;

            const midAngle = (d.startAngle + d.endAngle) / 2;
            const isRight = midAngle < Math.PI;

            // 引线起点（扇形边缘）
            const p0 = self.arc.centroid(d);
            // 引线折点（稍远处）
            const p1 = self.outerArc.centroid(d);
            // 引线终点（水平对齐到左/右边）
            const p2 = [isRight ? self.radius * 1.15 : -self.radius * 1.15, p1[1]];

            const percent = ((d.data.count / data.length) * 100).toFixed(1);

            d3.select(this).append('polyline')
                .attr('class', 'label-line')
                .attr('points', [p0, p1, p2].map(p => p.join(',')).join(' '))
                .style('fill', 'none')
                .style('stroke', '#b2bec3')
                .style('stroke-width', '1px');

            d3.select(this).append('text')
                .attr('class', 'label-text')
                .attr('transform', `translate(${p2})`)
                .attr('dx', isRight ? '5px' : '-5px') // ✨ 新增这一行：让文字和线稍微有一点呼吸感
                .style('text-anchor', isRight ? 'start' : 'end')
                .style('font-size', '12px')
                .style('fill', '#2d3436')
                .text(`${d.data.label} ${percent}%`);
                    });
    }
}