/**
 * 테이블 컨트롤러
 * DICOM 태그 정보를 테이블 형태로 표시
 */

import { appState } from "../core/appStateManager.js";
import { errorHandler } from "../core/errorHandler.js";

export class TableController {
  constructor() {
    this.currentData = null;
    this.filteredData = [];
    this.sortOrder = { column: null, direction: 'asc' };
    this.currentFilter = '';
    this.itemsPerPage = 50;
    this.currentPage = 1;
    this.totalItems = 0;
  }

  /**
   * 초기화
   */
  async initialize() {
    console.log("Table 컨트롤러 초기화");
    this.setupEventListeners();
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 검색 기능
    const searchInput = document.getElementById("tagSearch");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.filterTags(e.target.value);
      });
    }

    // 내보내기 버튼
    const exportBtn = document.getElementById("btnExportTags");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.exportTags();
      });
    }

    // 테이블 헤더 클릭 (정렬)
    this.setupTableSorting();
  }

  /**
   * 테이블 정렬 설정
   */
  setupTableSorting() {
    const headers = document.querySelectorAll("#tagTable th");
    headers.forEach((header, index) => {
      header.style.cursor = "pointer";
      header.addEventListener("click", () => {
        this.sortTable(index);
      });
    });
  }

  /**
   * 뷰 활성화
   */
  async activate() {
    const tableView = document.getElementById("tableView");
    if (tableView) {
      tableView.classList.remove("hidden");
    }

    // 데이터가 있으면 테이블 그리기
    if (this.currentData) {
      this.renderTable();
    }
  }

  /**
   * 뷰 비활성화
   */
  async deactivate() {
    const tableView = document.getElementById("tableView");
    if (tableView) {
      tableView.classList.add("hidden");
    }
  }

  /**
   * 데이터 로드
   * @param {Object} data - DICOM 데이터
   */
  async loadData(data) {
    try {
      this.currentData = this.processData(data);
      this.filteredData = [...this.currentData];
      this.totalItems = this.filteredData.length;
      this.renderTable();
      this.updateStatistics();
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "테이블 데이터 로드",
      });
    }
  }

  /**
   * DICOM 데이터를 테이블 형태로 변환
   * @param {Object} data - DICOM 데이터
   * @returns {Array} 태그 배열
   */
  processData(data) {
    const tags = [];

    if (!data.dicom_data?.children) {
      return tags;
    }

    data.dicom_data.children.forEach((group, groupIndex) => {
      if (group.children && Array.isArray(group.children)) {
        group.children.forEach((tag, tagIndex) => {
          tags.push({
            id: `${groupIndex}-${tagIndex}`,
            group: group.name || `Group ${groupIndex + 1}`,
            tagId: tag.tag_id || "N/A",
            description: tag.description || "No description",
            vr: tag.vr || "Unknown",
            vm: tag.vm || "Unknown",
            length: tag.value_length || 0,
            value: this.formatValue(tag.value_field),
            rawValue: tag.value_field,
            isPrivate: tag.is_private || false
          });
        });
      }
    });

    return tags;
  }

  /**
   * 값 포맷팅
   * @param {*} value - 원본 값
   * @returns {string} 포맷된 값
   */
  formatValue(value) {
    if (value === null || value === undefined) return "N/A";
    
    const str = String(value);
    
    // 이진 데이터 감지
    if (str.includes('\x00') || str.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/)) {
      return `[Binary data, ${str.length} bytes]`;
    }
    
    // 긴 텍스트 줄임
    return str.length > 100 ? str.substring(0, 100) + "..." : str;
  }

  /**
   * 테이블 렌더링
   */
  renderTable() {
    const tbody = document.getElementById("tagTableBody");
    if (!tbody) return;

    // 페이지네이션 계산
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageData = this.filteredData.slice(startIndex, endIndex);

    // 테이블 내용 생성
    tbody.innerHTML = "";

    pageData.forEach((tag) => {
      const row = document.createElement("tr");
      row.className = tag.isPrivate ? "bg-yellow-50" : "";
      
      row.innerHTML = `
        <td class="border border-gray-300 px-2 py-1 text-xs font-mono">
          ${tag.tagId}
        </td>
        <td class="border border-gray-300 px-2 py-1 text-xs" title="${tag.description}">
          ${tag.description.length > 40 ? tag.description.substring(0, 40) + "..." : tag.description}
        </td>
        <td class="border border-gray-300 px-2 py-1 text-xs text-center">
          ${tag.vr}
        </td>
        <td class="border border-gray-300 px-2 py-1 text-xs text-center">
          ${tag.vm}
        </td>
        <td class="border border-gray-300 px-2 py-1 text-xs text-right">
          ${tag.length.toLocaleString()}
        </td>
        <td class="border border-gray-300 px-2 py-1 text-xs break-all" title="${tag.rawValue}">
          ${tag.value}
        </td>
      `;

      // 행 클릭 이벤트
      row.addEventListener("click", () => {
        this.showTagDetails(tag);
      });

      tbody.appendChild(row);
    });

    // 페이지네이션 업데이트
    this.updatePagination();
  }

  /**
   * 태그 필터링
   * @param {string} query - 검색어
   */
  filterTags(query) {
    this.currentFilter = query.toLowerCase();
    
    if (!query) {
      this.filteredData = [...this.currentData];
    } else {
      this.filteredData = this.currentData.filter(tag => 
        tag.tagId.toLowerCase().includes(this.currentFilter) ||
        tag.description.toLowerCase().includes(this.currentFilter) ||
        tag.vr.toLowerCase().includes(this.currentFilter) ||
        tag.value.toLowerCase().includes(this.currentFilter)
      );
    }

    this.totalItems = this.filteredData.length;
    this.currentPage = 1; // 검색 시 첫 페이지로
    this.renderTable();
    this.updateStatistics();
  }

  /**
   * 테이블 정렬
   * @param {number} columnIndex - 컬럼 인덱스
   */
  sortTable(columnIndex) {
    const columns = ['tagId', 'description', 'vr', 'vm', 'length', 'value'];
    const column = columns[columnIndex];
    
    if (!column) return;

    // 정렬 방향 토글
    if (this.sortOrder.column === column) {
      this.sortOrder.direction = this.sortOrder.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortOrder.column = column;
      this.sortOrder.direction = 'asc';
    }

    // 정렬 실행
    this.filteredData.sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];

      // 숫자 컬럼 처리
      if (column === 'length') {
        aVal = Number(aVal);
        bVal = Number(bVal);
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return this.sortOrder.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortOrder.direction === 'asc' ? 1 : -1;
      return 0;
    });

    this.renderTable();
    this.updateSortHeaders();
  }

  /**
   * 정렬 헤더 업데이트
   */
  updateSortHeaders() {
    const headers = document.querySelectorAll("#tagTable th");
    const columns = ['tagId', 'description', 'vr', 'vm', 'length', 'value'];
    
    headers.forEach((header, index) => {
      const column = columns[index];
      header.innerHTML = header.textContent.replace(/[↑↓]/g, '');
      
      if (this.sortOrder.column === column) {
        const arrow = this.sortOrder.direction === 'asc' ? '↑' : '↓';
        header.innerHTML += ` ${arrow}`;
      }
    });
  }

  /**
   * 페이지네이션 업데이트
   */
  updatePagination() {
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    
    // 페이지네이션 컨트롤 생성/업데이트
    let paginationDiv = document.getElementById("tablePagination");
    if (!paginationDiv) {
      paginationDiv = document.createElement("div");
      paginationDiv.id = "tablePagination";
      paginationDiv.className = "flex justify-between items-center mt-4 px-4";
      
      const tableView = document.getElementById("tableView");
      tableView?.appendChild(paginationDiv);
    }

    paginationDiv.innerHTML = `
      <div class="text-sm text-gray-600">
        ${this.totalItems.toLocaleString()}개 태그 중 ${((this.currentPage - 1) * this.itemsPerPage + 1).toLocaleString()}-${Math.min(this.currentPage * this.itemsPerPage, this.totalItems).toLocaleString()}개 표시
      </div>
      <div class="flex space-x-2">
        <button ${this.currentPage === 1 ? 'disabled' : ''} 
                class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                onclick="window.tableController?.goToPage(${this.currentPage - 1})">
          이전
        </button>
        <span class="px-3 py-1 text-sm">${this.currentPage} / ${totalPages}</span>
        <button ${this.currentPage === totalPages ? 'disabled' : ''} 
                class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                onclick="window.tableController?.goToPage(${this.currentPage + 1})">
          다음
        </button>
      </div>
    `;

    // 전역 참조 설정 (임시)
    window.tableController = this;
  }

  /**
   * 페이지 이동
   * @param {number} page - 이동할 페이지
   */
  goToPage(page) {
    const totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.renderTable();
    }
  }

  /**
   * 통계 업데이트
   */
  updateStatistics() {
    const stats = {
      total: this.filteredData.length,
      groups: new Set(this.filteredData.map(t => t.group)).size,
      private: this.filteredData.filter(t => t.isPrivate).length,
      avgLength: this.filteredData.reduce((sum, t) => sum + t.length, 0) / this.filteredData.length || 0
    };

    // 통계 표시 영역이 있다면 업데이트
    let statsDiv = document.getElementById("tableStats");
    if (!statsDiv) {
      statsDiv = document.createElement("div");
      statsDiv.id = "tableStats";
      statsDiv.className = "bg-gray-100 p-3 rounded mb-4 text-sm";
      
      const tableView = document.getElementById("tableView");
      const tableContainer = tableView?.querySelector(".overflow-x-auto");
      tableContainer?.parentNode?.insertBefore(statsDiv, tableContainer);
    }

    statsDiv.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><strong>총 태그:</strong> ${stats.total.toLocaleString()}</div>
        <div><strong>그룹 수:</strong> ${stats.groups}</div>
        <div><strong>Private 태그:</strong> ${stats.private}</div>
        <div><strong>평균 길이:</strong> ${stats.avgLength.toFixed(1)} bytes</div>
      </div>
    `;
  }

  /**
   * 태그 상세 정보 표시
   * @param {Object} tag - 태그 정보
   */
  showTagDetails(tag) {
    const modal = document.createElement("div");
    modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    modal.innerHTML = `
      <div class="bg-white p-6 rounded-lg shadow-lg max-w-2xl mx-4 max-h-96 overflow-y-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold text-gray-800">태그 상세 정보</h3>
          <button class="close-btn text-gray-500 hover:text-gray-700 text-xl">&times;</button>
        </div>
        <div class="space-y-3 text-sm">
          <div><strong>태그 ID:</strong> ${tag.tagId}</div>
          <div><strong>그룹:</strong> ${tag.group}</div>
          <div><strong>설명:</strong> ${tag.description}</div>
          <div><strong>VR (Value Representation):</strong> ${tag.vr}</div>
          <div><strong>VM (Value Multiplicity):</strong> ${tag.vm}</div>
          <div><strong>길이:</strong> ${tag.length.toLocaleString()} bytes</div>
          <div><strong>Private 태그:</strong> ${tag.isPrivate ? 'Yes' : 'No'}</div>
          <div>
            <strong>값:</strong>
            <div class="mt-2 p-3 bg-gray-100 rounded text-xs font-mono break-all max-h-32 overflow-y-auto">
              ${tag.rawValue || 'N/A'}
            </div>
          </div>
        </div>
        <div class="mt-6 flex justify-end space-x-2">
          <button class="copy-btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
            값 복사
          </button>
          <button class="close-btn px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            닫기
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

    // 복사 이벤트
    modal.querySelector(".copy-btn")?.addEventListener("click", () => {
      navigator.clipboard.writeText(tag.rawValue || '').then(() => {
        alert("값이 클립보드에 복사되었습니다.");
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
   * 태그 내보내기
   */
  exportTags() {
    const exportData = this.filteredData.map(tag => ({
      'Tag ID': tag.tagId,
      'Group': tag.group,
      'Description': tag.description,
      'VR': tag.vr,
      'VM': tag.vm,
      'Length': tag.length,
      'Value': tag.rawValue,
      'Private': tag.isPrivate
    }));

    // CSV 형태로 내보내기
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => 
        headers.map(header => 
          `"${String(row[header]).replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');

    // 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dicom_tags_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  /**
   * 정리
   */
  cleanup() {
    this.currentData = null;
    this.filteredData = [];
    this.currentFilter = '';
    this.currentPage = 1;
    
    // 전역 참조 제거
    if (window.tableController === this) {
      delete window.tableController;
    }
  }
}

export default TableController;