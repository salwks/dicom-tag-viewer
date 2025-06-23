// chartController.js - 구조 보기 탭 관리

export function showChart() {
  // 탭 전환
  document.getElementById('dicomTree').classList.remove('hidden');
  document.getElementById('tagTableContainer').classList.add('hidden');
  document.getElementById('imageViewer').classList.add('hidden');

  const data = window.dicomData;
  if (!data) return alert("데이터가 없습니다.");

  try {
    // 기존 차트 제거
    d3.select("#dicomTree").selectAll("*").remove();

    const width = 800;
    const height = 800;
    const radius = width / 2;

    // D3 계층 구조 생성
    const root = d3.hierarchy(data);
    const treeLayout = d3.cluster().size([2 * Math.PI, radius - 100]);
    treeLayout(root);

    // SVG 생성
    const svg = d3.select("#dicomTree").append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // 링크 그리기
    svg.selectAll("path")
      .data(root.links())
      .enter()
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "#ccc")
      .attr("d", d => {
        const start = polarToCartesian(d.source.x, d.source.y);
        const end = polarToCartesian(d.target.x, d.target.y);
        return `M${start.x},${start.y}L${end.x},${end.y}`;
      });

    // 노드 그리기
    svg.selectAll("circle")
      .data(root.descendants())
      .enter()
      .append("circle")
      .attr("transform", d => {
        const { x, y } = polarToCartesian(d.x, d.y);
        return `translate(${x},${y})`;
      })
      .attr("r", 3)
      .attr("fill", "#69b3a2");

    // 텍스트 라벨
    svg.selectAll("text")
      .data(root.descendants())
      .enter()
      .append("text")
      .attr("dy", "0.31em")
      .attr("font-size", "10px")
      .attr("transform", d => {
        const { x, y } = polarToCartesian(d.x, d.y);
        return `translate(${x},${y}) rotate(${(d.x * 180 / Math.PI - 90)})`;
      })
      .attr("text-anchor", d => (d.x < Math.PI ? "start" : "end"))
      .text(d => d.data.name || d.data.description || d.data.tag_id || '');

  } catch (err) {
    console.error("트리 렌더링 오류:", err);
  }
}

// 극좌표를 직교좌표로 변환
function polarToCartesian(angle, radius) {
  return {
    x: radius * Math.cos(angle - Math.PI / 2),
    y: radius * Math.sin(angle - Math.PI / 2)
  };
}