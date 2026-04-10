class BubbleChart {
    constructor(containerId, data) {
        this.container = d3.select(containerId);
        this.width = 450;
        this.height = 320;
        this.init();
        this.updateData(data);
    }

    init() {
        this.svg = this.container.append('svg')
            .attr('width', '100%')
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .append('g')
            .attr('transform', `translate(${this.width / 2},${this.height / 2})`);

        this.tooltip = d3.select('body').append('div')
            .style('position', 'absolute')
            .style('background', 'rgba(0,0,0,0.8)')
            .style('color', '#fff')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('font-size', '12px')
            .style('pointer-events', 'none')
            .style('opacity', 0);
    }

    updateData(data) {
        this.svg.selectAll('*').remove();
        if (!data || data.length === 0) return;

        const artistCounts = d3.rollup(data, v => v.length, d => d.artists);
        let topArtists = Array.from(artistCounts, ([artist, count]) => ({ id: artist, value: count }))
            .sort((a, b) => b.value - a.value).slice(0, 15);

        const sizeScale = d3.scaleSqrt()
            .domain([0, d3.max(topArtists, d => d.value)])
            .range([10, 45]);

        const simulation = d3.forceSimulation(topArtists)
            .force('charge', d3.forceManyBody().strength(5))
            .force('center', d3.forceCenter(0, 0))
            .force('collision', d3.forceCollide().radius(d => sizeScale(d.value) + 2));

        const nodes = this.svg.selectAll('circle')
            .data(topArtists)
            .enter().append('g');

        const circles = nodes.append('circle')
            .attr('r', d => sizeScale(d.value))
            .style('fill', '#1DB954')
            .style('stroke', '#fff')
            .style('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseover', (event, d) => {
                d3.select(event.currentTarget).style('fill', '#1ed760');
                this.tooltip.transition().duration(200).style('opacity', 1);
                this.tooltip.html(`${d.id}<br><b>${d.value} 首</b>`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', (event) => {
                d3.select(event.currentTarget).style('fill', '#1DB954');
                this.tooltip.transition().duration(500).style('opacity', 0);
            });

        const labels = nodes.append('text')
            .text(d => d.id.length > 8 ? d.id.substring(0, 8) + '...' : d.id)
            .style('text-anchor', 'middle')
            .style('fill', '#fff')
            .style('font-size', '10px')
            .style('pointer-events', 'none')
            .attr('dy', '.3em');

        simulation.on('tick', () => {
            circles.attr('cx', d => d.x).attr('cy', d => d.y);
            labels.attr('x', d => d.x).attr('y', d => d.y);
        });
    }
}