/**
 * 차트 컨트롤러
 * DICOM 구조를 D3 Radial Cluster Tree로 시각화
 */

import { appState } from "../core/appStateManager.js";
import { errorHandler } from "../core/errorHandler.js";

export class ChartController {
  constructor() {
    this.svg = null;
    this.g = null;
    this.zoom = null;
    this.tree = null;
    this.currentData = null;
    this.width = 0;
    this.height = 0;
    this.radius = 0;
  }

  /**
   * 초기화
   */
  async initialize() {
    console.log("Chart 컨트롤러 초기화");
    this.setupEventListeners();
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 윈도우 리사이즈 이벤트
    window.addEventListener("resize", () => {
      if (this.currentData) {
        this.updateDimensions();
        this.redraw();
      }
    });

    // 차트 컨트롤 버튼들
    document.getElementById("chartZoomIn")?.addEventListener("click", () => {
      this.zoomByFactor(1.5);
    });

    document.getElementById("chartZoomOut")?.addEventListener("click", () => {
      this.zoomByFactor(0.75);
    });

    document.getElementById("chartFitView")?.addEventListener("click", () => {
      this.fitToView();
    });

    document.getElementById("chartReset")?.addEventListener("click", () => {
      this.resetZoom();
    });
  }

  /**
   * 뷰 활성화
   */
  async activate() {
    const chartView = document.getElementById("chartView");
    if (chartView) {
      chartView.classList.remove("hidden");
    }
    
    // 데이터가 있으면 차트 그리기
    if (this.currentData) {
      this.createChart();
    }
  }

  /**
   * 뷰 비활성화
   */
  async deactivate() {
    const chartView = document.getElementById("chartView");
    if (chartView) {
      chartView.classList.add("hidden");
    }
  }

  /**
   * 데이터 로드
   * @param {Object} data - DICOM 데이터
   */
  async loadData(data) {
    try {
      this.currentData = this.processData(data);
      this.createChart();
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "차트 데이터 로드",
      });
    }
  }

  /**
   * DICOM 데이터를 D3 트리 형태로 변환
   * @param {Object} data - DICOM 데이터
   * @returns {Object} 처리된 트리 데이터
   */
  processData(data) {
    if (!data.dicom_data) {
      return {
        name: "DICOM File",
        children: []
      };
    }

    const dicomData = data.dicom_data;
    
    // 루트 노드 생성
    const root = {
      name: "DICOM Information",
      children: [],
      type: "root",
      size: 20
    };

    // 각 그룹 처리
    if (dicomData.children && Array.isArray(dicomData.children)) {
      dicomData.children.forEach((group, index) => {
        if (group.children && group.children.length > 0) {
          const groupNode = {
            name: group.name || `Group ${index + 1}`,
            children: [],
            type: "group",
            size: 15,
            tagCount: group.children.length
          };

          // 태그 개수가 많은 경우 일부만 표시하고 요약 정보 추가
          const maxTagsToShow = 20;
          const tags = group.children.slice(0, maxTagsToShow);
          
          tags.forEach((tag) => {
            const tagNode = {
              name: this.formatTagName(tag),
              type: "tag",
              size: 8,
              tag: tag,
              description: tag.description || "No description",
              value: this.formatTagValue(tag.value_field),
              vr: tag.vr || "Unknown",
              vm: tag.vm || "Unknown"
            };
            groupNode.children.push(tagNode);
          });

          // 더 많은 태그가 있는 경우 요약 노드 추가
          if (group.children.length > maxTagsToShow) {
            groupNode.children.push({
              name: `... ${group.children.length - maxTagsToShow} more tags`,
              type: "summary",
              size: 6,
              hiddenCount: group.children.length - maxTagsToShow
            });
          }

          root.children.push(groupNode);
        }
      });
    }

    return root;
  }

  /**
   * 태그 이름 포맷팅
   * @param {Object} tag - 태그 객체
   * @returns {string} 포맷된 이름
   */
  formatTagName(tag) {
    if (tag.tag_id && tag.description) {
      return `${tag.tag_id}`;
    } else if (tag.description) {
      return tag.description.substring(0, 30);
    } else if (tag.tag_id) {
      return tag.tag_id;
    }
    return "Unknown Tag";
  }

  /**
   * 태그 값 포맷팅
   * @param {string} value - 원본 값
   * @returns {string} 포맷된 값
   */
  formatTagValue(value) {
    if (!value) return "N/A";
    const str = String(value);
    return str.length > 50 ? str.substring(0, 50) + "..." : str;
  }

  /**
   * 차트 생성
   */
  createChart() {
    if (!this.currentData) return;

    this.clearChart();
    this.updateDimensions();
    this.setupSVG();
    this.drawTree();
  }

  /**
   * 기존 차트 제거
   */
  clearChart() {
    const container = document.getElementById("chartContainer");
    if (container) {
      container.innerHTML = "";
    }
  }

  /**
   * 차트 크기 업데이트
   */
  updateDimensions() {
    const container = document.getElementById("chartContainer");
    if (!container) return;

    const rect = container.getBoundingClientRect();
    this.width = Math.max(400, rect.width - 20); // 최소 크기와 여백 고려
    this.height = Math.max(400, rect.height - 20);
    this.radius = Math.min(this.width, this.height) / 2 - 60; // 반지름 계산
  }

  /**
   * SVG 설정
   */
  setupSVG() {
    const container = document.getElementById("chartContainer");
    if (!container) return;

    // SVG 생성
    this.svg = d3.select(container)
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height)
      .style("font-family", "Arial, sans-serif");

    // 줌 기능 설정
    this.zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        this.g.attr("transform", event.transform);
      });

    this.svg.call(this.zoom);

    // 메인 그룹 생성 (중앙 정렬)
    this.g = this.svg.append("g")
      .attr("transform", `translate(${this.width / 2}, ${this.height / 2})`);

    // 배경 클릭 이벤트 (줌 리셋)
    this.svg.append("rect")
      .attr("width", this.width)
      .attr("height", this.height)
      .style("fill", "none")
      .style("pointer-events", "all")
      .on("dblclick", () => {
        this.resetZoom();
      });
  }

  /**
   * 트리 그리기
   */
  drawTree() {
    // 클러스터 레이아웃 생성
    const cluster = d3.cluster()
      .size([2 * Math.PI, this.radius - 100])
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth);

    // 계층 구조 생성
    const root = d3.hierarchy(this.currentData);
    
    // 클러스터 레이아웃 적용
    cluster(root);

    // 링크 그리기
    this.drawLinks(root);
    
    // 노드 그리기
    this.drawNodes(root);

    // 초기 줌 맞춤
    this.fitToView();
  }

  /**
   * 링크(연결선) 그리기
   * @param {Object} root - 루트 노드
   */
  drawLinks(root) {
    const linkGenerator = d3.linkRadial()
      .angle(d => d.x)
      .radius(d => d.y);

    this.g.selectAll(".link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "link")
      .attr("d", linkGenerator)
      .style("fill", "none")
      .style("stroke", "#999")
      .style("stroke-width", d => {
        // 깊이에 따라 선 굵기 조정
        return Math.max(1, 3 - d.source.depth);
      })
      .style("stroke-opacity", 0.6);
  }

  /**
   * 노드 그리기
   * @param {Object} root - 루트 노드
   */
  drawNodes(root) {
    const node = this.g.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", d => {
        return `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y}, 0)`;
      });

    // 노드 원 그리기
    node.append("circle")
      .attr("r", d => d.data.size || 5)
      .style("fill", d => this.getNodeColor(d.data.type))
      .style("stroke", "#fff")
      .style("stroke-width", 2)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => this.showTooltip(event, d))
      .on("mouseout", () => this.hideTooltip())
      .on("click", (event, d) => this.handleNodeClick(event, d));

    // 텍스트 레이블 추가
    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.x < Math.PI === !d.children ? 6 : -6)
      .attr("text-anchor", d => d.x < Math.PI === !d.children ? "start" : "end")
      .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
      .style("font-size", d => `${Math.max(8, d.data.size || 10)}px`)
      .style("fill", "#333")
      .style("pointer-events", "none")
      .text(d => {
        const maxLength = d.depth === 0 ? 20 : (d.depth === 1 ? 15 : 12);
        return d.data.name.length > maxLength ? 
          d.data.name.substring(0, maxLength) + "..." : 
          d.data.name;
      });
  }

  /**
   * 노드 타입별 색상 반환
   * @param {string} type - 노드 타입
   * @returns {string} 색상 코드
   */
  getNodeColor(type) {
    const colors = {
      root: "#2563eb",      // 파란색
      group: "#dc2626",     // 빨간색
      tag: "#16a34a",       // 초록색
      summary: "#9333ea"    // 보라색
    };
    return colors[type] || "#6b7280";
  }

  /**
   * 툴팁 표시
   * @param {Event} event - 마우스 이벤트
   * @param {Object} d - 노드 데이터
   */
  showTooltip(event, d) {
    // 기존 툴팁 제거
    d3.select(".chart-tooltip").remove();

    const tooltip = d3.select("body").append("div")
      .attr("class", "chart-tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.9)")
      .style("color", "white")
      .style("padding", "8px 12px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("z-index", "1000")
      .style("opacity", 0);

    let content = `<strong>${d.data.name}</strong>`;
    
    if (d.data.type === "tag" && d.data.tag) {
      content += `<br/>Description: ${d.data.description}`;
      content += `<br/>VR: ${d.data.vr}, VM: ${d.data.vm}`;
      content += `<br/>Value: ${d.data.value}`;
    } else if (d.data.type === "group" && d.data.tagCount) {
      content += `<br/>Tags: ${d.data.tagCount}`;
    } else if (d.data.type === "summary") {
      content += `<br/>Hidden tags: ${d.data.hiddenCount}`;
    }

    tooltip.html(content)
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 10) + "px")
      .transition()
      .duration(200)
      .style("opacity", 1);
  }

  /**
   * 툴팁 숨김
   */
  hideTooltip() {
    d3.select(".chart-tooltip").remove();
  }

  /**
   * 노드 클릭 처리
   * @param {Event} event - 클릭 이벤트
   * @param {Object} d - 노드 데이터
   */
  handleNodeClick(event, d) {
    event.stopPropagation();
    
    if (d.data.type === "tag" && d.data.tag) {
      // 태그 상세 정보 표시
      this.showTagDetails(d.data.tag);
    } else if (d.data.type === "group") {
      // 그룹 정보 표시
      this.showGroupDetails(d.data);
    }

    // 노드로 줌인
    this.zoomToNode(d);
  }

  /**
   * 태그 상세 정보 표시
   * @param {Object} tag - 태그 데이터
   */
  showTagDetails(tag) {
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg max-w-md mx-4 max-h-80 overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold text-gray-800">Tag Details</h3>
          <button class="close-btn text-gray-500 hover:text-gray-700 text-xl">&times;</button>
        </div>
        <div class="space-y-2 text-sm">
          <div><strong>Tag ID:</strong> ${tag.tag_id || "N/A"}</div>
          <div><strong>Description:</strong> ${tag.description || "N/A"}</div>
          <div><strong>VR:</strong> ${tag.vr || "N/A"}</div>
          <div><strong>VM:</strong> ${tag.vm || "N/A"}</div>
          <div><strong>Length:</strong> ${tag.value_length || 0} bytes</div>
          <div><strong>Value:</strong> 
            <div class="mt-1 p-2 bg-gray-100 rounded text-xs break-all">
              ${String(tag.value_field || "N/A")}
            </div>
          </div>
        </div>
        <div class="mt-4 flex justify-end">
          <button class="close-btn px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 닫기 이벤트
    modal.querySelectorAll(".close-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        modal.remove();
      });
    });

    // 배경 클릭으로 닫기
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * 그룹 상세 정보 표시
   * @param {Object} group - 그룹 데이터
   */
  showGroupDetails(group) {
    alert(`Group: ${group.name}\nTags: ${group.tagCount || 0}`);
  }

  /**
   * 노드로 줌인
   * @param {Object} node - 대상 노드
   */
  zoomToNode(node) {
    const scale = 2;
    const x = -node.y * Math.cos(node.x - Math.PI / 2) * scale + this.width / 2;
    const y = -node.y * Math.sin(node.x - Math.PI / 2) * scale + this.height / 2;

    this.svg.transition()
      .duration(750)
      .call(
        this.zoom.transform,
        d3.zoomIdentity.translate(x, y).scale(scale)
      );
  }

  /**
   * 뷰에 맞춤
   */
  fitToView() {
    const bounds = this.g.node().getBBox();
    const fullWidth = this.width;
    const fullHeight = this.height;
    const scale = 0.8 * Math.min(fullWidth / bounds.width, fullHeight / bounds.height);
    const translate = [
      fullWidth / 2 - scale * (bounds.x + bounds.width / 2),
      fullHeight / 2 - scale * (bounds.y + bounds.height / 2)
    ];

    this.svg.transition()
      .duration(750)
      .call(
        this.zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
  }

  /**
   * 줌 리셋
   */
  resetZoom() {
    this.svg.transition()
      .duration(750)
      .call(
        this.zoom.transform,
        d3.zoomIdentity
      );
  }

  /**
   * 줌 팩터로 확대/축소
   * @param {number} factor - 줌 팩터
   */
  zoomByFactor(factor) {
    this.svg.transition()
      .duration(300)
      .call(
        this.zoom.scaleBy,
        factor
      );
  }

  /**
   * 차트 다시 그리기
   */
  redraw() {
    if (this.currentData) {
      this.createChart();
    }
  }

  /**
   * 리사이즈 처리
   */
  handleResize() {
    if (this.currentData) {
      this.updateDimensions();
      this.redraw();
    }
  }

  /**
   * 정리
   */
  cleanup() {
    this.clearChart();
    this.currentData = null;
    this.svg = null;
    this.g = null;
    this.zoom = null;
  }
}