class Timeline {
    constructor(containerId, data) {
        this.container = d3.select(containerId);
        this.margin = { top: 20, right: 130, bottom: 50, left: 60 };
        // 配合并排布局，宽度设为 100% 自适应
        this.width = 800 - this.margin.left - this.margin.right; 
        this.height = 300 - this.margin.top - this.margin.bottom;
        this.init();
        this.updateData(data);
    }

    init() {
        // 创建独立 tooltip 元素
        this.tooltip = d3.select('body').append('div')
            .attr('class', 'timeline-tooltip')
            .style('position', 'absolute')
            .style('background', 'rgba(25, 20, 20, 0.95)')
            .style('color', '#fff')
            .style('padding', '12px')
            .style('border-radius', '8px')
            .style('pointer-events', 'none')
            .style('font-size', '13px')
            .style('box-shadow', '0 4px 12px rgba(0,0,0,0.2)')
            .style('opacity', 0)
            .style('z-index', 1000);

        this.svg = this.container.append('svg')
            .attr('width', '100%')
            .attr('viewBox', `0 0 ${this.width + this.margin.left + this.margin.right} ${this.height + this.margin.top + this.margin.bottom}`)
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
            
        this.xAxisG = this.svg.append('g').attr('transform', `translate(0,${this.height})`);
        this.yAxisG = this.svg.append('g');
        this.contentG = this.svg.append('g');

        // === 交互专用的隐形覆盖层和指示线 ===
        this.hoverLine = this.svg.append('line')
            .attr('class', 'hover-line')
            .attr('y1', 0).attr('y2', this.height)
            .style('stroke', '#a4b0be')
            .style('stroke-width', '1.5px')
            .style('stroke-dasharray', '4,4')
            .style('opacity', 0);
            
    }

    updateData(data) {
        if (!data || data.length === 0) {
            this.contentG.selectAll('*').remove();
            return;
        }

        const yearData = d3.rollup(
            data,
            v => ({
                count: v.length,
                avgEnergy: d3.mean(v, d => d.energy),
                avgDance: d3.mean(v, d => d.danceability),
                avgValence: d3.mean(v, d => d.valence),
                avgAcoustic: d3.mean(v, d => d.acousticness)
            }),
            d => d.year
        );

        this.timelineData = Array.from(yearData, ([year, values]) => ({
            year, ...values
        })).sort((a, b) => a.year - b.year);

        this.xScale = d3.scaleLinear()
            .domain(d3.extent(this.timelineData, d => d.year))
            .range([0, this.width]);

        this.yScale = d3.scaleLinear().domain([0, 1]).range([this.height, 0]);

        this.render();
        this.setupInteraction();
    }

    render() {
        this.contentG.selectAll('*').remove();
        this.svg.selectAll('.legend').remove();

        const features = ['avgEnergy', 'avgDance', 'avgValence', 'avgAcoustic'];
        const colors = ['#e74c3c', '#2ecc71', '#3498db', '#f39c12'];
        const labels = ['能量', '舞蹈性', '情绪', '声学性'];

        features.forEach((feature, i) => {
            const area = d3.area()
                .x(d => this.xScale(d.year))
                .y0(this.height)
                .y1(d => this.yScale(d[feature] ?? 0))
                .curve(d3.curveMonotoneX);

            this.contentG.append('path')
                .datum(this.timelineData)
                .attr('fill', colors[i]).attr('opacity', 0.15)
                .attr('d', area)
                .style('pointer-events', 'none');

            const line = d3.line()
                .x(d => this.xScale(d.year))
                .y(d => this.yScale(d[feature] ?? 0))
                .curve(d3.curveMonotoneX);

            this.contentG.append('path')
                .datum(this.timelineData)
                .attr('fill', 'none')
                .attr('stroke', colors[i])
                .attr('stroke-width', 2.5)
                .attr('d', line)
                .style('pointer-events', 'none');
        });

        this.xAxisG.call(d3.axisBottom(this.xScale).ticks(10).tickFormat(d3.format('d')));
        this.yAxisG.call(d3.axisLeft(this.yScale).ticks(5));

        // 图例
        const legend = this.svg.append('g').attr('class', 'legend').attr('transform', `translate(${this.width + 15}, 10)`);
        features.forEach((feature, i) => {
            const row = legend.append('g').attr('transform', `translate(0, ${i * 25})`);
            row.append('rect').attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', colors[i]);
            row.append('text').attr('x', 20).attr('y', 10).text(labels[i]).style('font-size', '11px').style('fill', '#2d3436');
        });
    }

    setupInteraction() {
        this.overlay = this.svg.append('rect')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('fill', 'none')
            .style('pointer-events', 'all');
        
            
        const bisectYear = d3.bisector(d => d.year).left;

        this.overlay
            .on('mouseover', () => {
                this.hoverLine.style('opacity', 1);
                this.tooltip.style('opacity', 1);
            })
            .on('mouseout', () => {
                this.hoverLine.style('opacity', 0);
                this.tooltip.style('opacity', 0);
            })
            .on('mousemove', (event) => {
                // 计算当前鼠标位置对应的年份
                const x0 = this.xScale.invert(d3.pointer(event)[0]);
                const i = bisectYear(this.timelineData, x0, 1);
                const d0 = this.timelineData[i - 1];
                const d1 = this.timelineData[i];
                if (!d0 || !d1) return;
                
                // 找出离鼠标更近的那一年的数据
                const d = x0 - d0.year > d1.year - x0 ? d1 : d0;
                
                const hoverX = this.xScale(d.year);
                this.hoverLine.attr('x1', hoverX).attr('x2', hoverX);

                // 拼装 Tooltip 内容
                this.tooltip.html(`
                    <div style="text-align:center; font-weight:bold; margin-bottom:8px; border-bottom:1px solid #444; padding-bottom:4px;">
                        ${d.year} 年 <span style="font-weight:normal; color:#aaa; font-size:11px;">(${d.count}首)</span>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr auto; gap: 8px 16px;">
                        <span style="color:#e74c3c;">● 能量</span> <span>${d.avgEnergy.toFixed(3)}</span>
                        <span style="color:#2ecc71;">● 舞蹈性</span> <span>${d.avgDance.toFixed(3)}</span>
                        <span style="color:#3498db;">● 情绪</span> <span>${d.avgValence.toFixed(3)}</span>
                        <span style="color:#f39c12;">● 声学性</span> <span>${d.avgAcoustic.toFixed(3)}</span>
                    </div>
                `)
                .style('left', (event.pageX + 20) + 'px')
                .style('top', (event.pageY - 50) + 'px');
            });
    }
}