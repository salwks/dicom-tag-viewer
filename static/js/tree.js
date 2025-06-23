export function drawRadialTree(data) {
  const container = document.getElementById('dicomTree');
  container.innerHTML = '';
  const width = window.innerWidth;
  const height = window.innerHeight - 128;
  const radius = Math.min(width, height) / 2;
  const svg = d3.select(container).append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(d3.zoom().scaleExtent([0.5, 5]).on("zoom", (event) => {
      svgGroup.attr("transform", event.transform);
    }));
  const svgGroup = svg.append("g").attr("transform", `translate(${width / 2},${height / 2})`);
  const tree = d3.cluster().size([2 * Math.PI, radius - 100]);
  const root = d3.hierarchy(data);
  tree(root);
  const colorScale = d3.scaleOrdinal().domain(["File Meta Information", "Patient Information", "Study Information", "Series Information", "Image Information", "Pixel Data"])
    .range(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"]);
  function getNodeColor(d) {
    if (d.depth === 1) return colorScale(d.data.name) || 'gray';
    if (d.parent) return getNodeColor(d.parent);
    return 'gray';
  }
  svgGroup.selectAll('path').data(root.links()).join('path')
    .attr('d', d3.linkRadial().angle(d => d.x).radius(d => d.y))
    .attr('fill', 'none').attr('stroke', '#ccc');
  svgGroup.selectAll('circle').data(root.descendants()).join('circle')
    .attr('transform', d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y})`)
    .attr('r', 4).attr('fill', d => getNodeColor(d));
  svgGroup.selectAll('text').data(root.descendants()).join('text')
    .attr('transform', d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y}) rotate(${d.x >= Math.PI ? 180 : 0})`)
    .attr('dy', '0.35em').attr('x', d => d.x < Math.PI ? 8 : -8)
    .attr('text-anchor', d => d.x < Math.PI ? 'start' : 'end')
    .text(d => d.data.name || d.data.description || '')
    .style('font-size', '12px').style('fill', '#333');
}