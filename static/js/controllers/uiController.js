/**
 * UI 컨트롤러
 * 사용자 인터페이스 관리 및 상태 표시를 담당
 */

import { appState } from "../core/appStateManager.js";
import { errorHandler } from "../core/errorHandler.js";

export class UIController {
  constructor() {
    this.elements = {};
    this.currentView = null;
    this.messageQueue = [];
    this.isShowingMessage = false;
  }

  /**
   * 초기화
   */
  async initialize() {
    this.cacheElements();
    this.setupEventListeners();
    this.initializeTooltips();

    console.log("UI 컨트롤러 초기화 완료");
  }

  /**
   * DOM 요소 캐싱
   */
  cacheElements() {
    this.elements = {
      // 메인 컨테이너
      app: document.getElementById("app"),
      header: document.getElementById("header"),

      // 파일 관련
      fileInput: document.getElementById("fileInput"),
      btnSelectFile: document.getElementById("btnSelectFile"),
      btnSelectFileWelcome: document.getElementById("btnSelectFileWelcome"),
      btnUpload: document.getElementById("btnUpload"),
      fileInfo: document.getElementById("fileInfo"),
      fileName: document.getElementById("fileName"),
      fileSize: document.getElementById("fileSize"),

      // 로딩 관련
      loadingIndicator: document.getElementById("loadingIndicator"),
      progressContainer: document.getElementById("progressContainer"),
      progressBar: document.getElementById("progressBar"),

      // 뷰 전환 버튼
      btnChartView: document.getElementById("btnChartView"),
      btnTableView: document.getElementById("btnTableView"),
      btnViewerView: document.getElementById("btnViewerView"),

      // 화면들
      welcomeScreen: document.getElementById("welcomeScreen"),
      dropZone: document.getElementById("dropZone"),
      chartView: document.getElementById("chartView"),
      tableView: document.getElementById("tableView"),
      viewerView: document.getElementById("viewerView"),

      // 상태바
      statusBar: document.getElementById("statusBar"),
      statusText: document.getElementById("statusText"),
      coordinateInfo: document.getElementById("coordinateInfo"),
    };
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 파일 선택 버튼들
    this.elements.btnSelectFile?.addEventListener("click", () => {
      this.elements.fileInput?.click();
    });

    this.elements.btnSelectFileWelcome?.addEventListener("click", () => {
      this.elements.fileInput?.click();
    });

    // 업로드 버튼
    this.elements.btnUpload?.addEventListener("click", () => {
      appState.emit("upload-requested");
    });

    // 뷰 전환 버튼들
    this.elements.btnChartView?.addEventListener("click", () => {
      appState.setState("currentView", "chart");
    });

    this.elements.btnTableView?.addEventListener("click", () => {
      appState.setState("currentView", "table");
    });

    this.elements.btnViewerView?.addEventListener("click", () => {
      appState.setState("currentView", "viewer");
    });

    // 드래그 앤 드롭 영역 클릭
    this.elements.dropZone?.addEventListener("click", () => {
      this.elements.fileInput?.click();
    });
  }

  /**
   * 툴팁 초기화
   */
  initializeTooltips() {
    // 툴팁이 필요한 요소들에 이벤트 리스너 추가
    const tooltipElements = document.querySelectorAll("[data-tooltip]");

    tooltipElements.forEach((element) => {
      element.addEventListener("mouseenter", (e) => {
        this.showTooltip(e.target, e.target.dataset.tooltip);
      });

      element.addEventListener("mouseleave", () => {
        this.hideTooltip();
      });
    });
  }

  /**
   * 웰컴 화면 표시
   */
  showWelcomeScreen() {
    this.hideAllViews();
    this.elements.welcomeScreen?.classList.remove("hidden");
    this.elements.dropZone?.classList.remove("hidden");
    this.currentView = "welcome";
  }

  /**
   * 모든 뷰 숨김
   */
  hideAllViews() {
    const views = [
      this.elements.welcomeScreen,
      this.elements.chartView,
      this.elements.tableView,
      this.elements.viewerView,
      this.elements.dropZone,
    ];

    views.forEach((view) => {
      view?.classList.add("hidden");
    });
  }

  /**
   * 특정 뷰 표시
   * @param {string} viewName - 표시할 뷰 이름
   */
  showView(viewName) {
    this.hideAllViews();

    if (viewName === "welcome") {
      this.elements.welcomeScreen?.classList.remove("hidden");
      this.elements.dropZone?.classList.remove("hidden");
    } else {
      const viewElement = this.elements[`${viewName}View`];
      if (viewElement) {
        viewElement.classList.remove("hidden");
      }
    }

    this.currentView = viewName;

    // 상태바 표시 (웰컴 화면이 아닌 경우)
    if (viewName !== "welcome") {
      this.elements.statusBar?.classList.remove("hidden");
    } else {
      this.elements.statusBar?.classList.add("hidden");
    }
  }

  /**
   * 뷰 버튼 상태 업데이트
   * @param {string} activeView - 활성 뷰
   */
  updateViewButtons(activeView) {
    const buttons = [
      { element: this.elements.btnChartView, view: "chart" },
      { element: this.elements.btnTableView, view: "table" },
      { element: this.elements.btnViewerView, view: "viewer" },
    ];

    buttons.forEach(({ element, view }) => {
      if (!element) return;

      if (view === activeView) {
        element.classList.remove("bg-gray-500");
        element.classList.add("bg-blue-500");
      } else {
        element.classList.remove("bg-blue-500");
        element.classList.add("bg-gray-500");
      }
    });
  }

  /**
   * 뷰 버튼 활성화
   */
  enableViewButtons() {
    const buttons = [
      this.elements.btnChartView,
      this.elements.btnTableView,
      this.elements.btnViewerView,
    ];

    buttons.forEach((button) => {
      if (button) {
        button.disabled = false;
        button.classList.remove("opacity-50", "cursor-not-allowed");
      }
    });
  }

  /**
   * 뷰 버튼 비활성화
   */
  disableViewButtons() {
    const buttons = [
      this.elements.btnChartView,
      this.elements.btnTableView,
      this.elements.btnViewerView,
    ];

    buttons.forEach((button) => {
      if (button) {
        button.disabled = true;
        button.classList.add("opacity-50", "cursor-not-allowed");
      }
    });
  }

  /**
   * 파일 정보 표시
   * @param {File} file - 파일 객체
   */
  showFileInfo(file) {
    if (this.elements.fileName) {
      this.elements.fileName.textContent = file.name;
    }

    if (this.elements.fileSize) {
      this.elements.fileSize.textContent = `(${this.formatFileSize(
        file.size
      )})`;
    }

    this.elements.fileInfo?.classList.remove("hidden");
  }

  /**
   * 파일 정보 숨김
   */
  hideFileInfo() {
    this.elements.fileInfo?.classList.add("hidden");
  }

  /**
   * 로딩 상태 설정
   * @param {boolean} isLoading - 로딩 중 여부
   * @param {string} message - 로딩 메시지
   */
  setLoadingState(isLoading, message = "처리 중...") {
    if (isLoading) {
      this.elements.loadingIndicator?.classList.remove("hidden");
      const loadingText = this.elements.loadingIndicator?.querySelector("span");
      if (loadingText) {
        loadingText.textContent = message;
      }

      // 업로드 버튼 비활성화
      if (this.elements.btnUpload) {
        this.elements.btnUpload.disabled = true;
        this.elements.btnUpload.classList.add(
          "opacity-50",
          "cursor-not-allowed"
        );
      }
    } else {
      this.elements.loadingIndicator?.classList.add("hidden");
      this.hideProgress();

      // 업로드 버튼 활성화
      if (this.elements.btnUpload && appState.getState("uploadedFile")) {
        this.elements.btnUpload.disabled = false;
        this.elements.btnUpload.classList.remove(
          "opacity-50",
          "cursor-not-allowed"
        );
      }
    }
  }

  /**
   * 진행률 표시
   * @param {number} progress - 진행률 (0-100)
   */
  showProgress(progress = 0) {
    this.elements.progressContainer?.classList.remove("hidden");

    if (this.elements.progressBar) {
      this.elements.progressBar.style.width = `${Math.max(
        0,
        Math.min(100, progress)
      )}%`;
    }
  }

  /**
   * 진행률 숨김
   */
  hideProgress() {
    this.elements.progressContainer?.classList.add("hidden");

    if (this.elements.progressBar) {
      this.elements.progressBar.style.width = "0%";
    }
  }

  /**
   * 메시지 표시
   * @param {string} message - 메시지 내용
   * @param {string} type - 메시지 타입 ('success', 'error', 'warning', 'info')
   * @param {number} duration - 표시 시간 (밀리초)
   */
  async showMessage(message, type = "info", duration = 3000) {
    const messageObj = { message, type, duration, id: Date.now() };

    if (this.isShowingMessage) {
      this.messageQueue.push(messageObj);
      return;
    }

    await this.displayMessage(messageObj);
  }

  /**
   * 메시지 표시 (내부)
   * @param {Object} messageObj - 메시지 객체
   */
  async displayMessage(messageObj) {
    this.isShowingMessage = true;

    const { message, type, duration } = messageObj;

    // 기존 메시지 제거
    const existingMessage = document.querySelector(".toast-message");
    if (existingMessage) {
      existingMessage.remove();
    }

    // 메시지 요소 생성
    const messageElement = document.createElement("div");
    messageElement.className = `toast-message fixed top-24 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform translate-x-full transition-transform duration-300`;

    // 타입별 스타일 적용
    const styles = {
      success: "bg-green-500 text-white",
      error: "bg-red-500 text-white",
      warning: "bg-yellow-500 text-white",
      info: "bg-blue-500 text-white",
    };

    const icons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };

    messageElement.classList.add(...styles[type].split(" "));
    messageElement.innerHTML = `
      <div class="flex items-center">
        <span class="text-xl mr-3">${icons[type]}</span>
        <div class="flex-1">
          <p class="font-medium">${message}</p>
        </div>
        <button class="ml-3 text-white hover:text-gray-200" onclick="this.parentElement.parentElement.remove()">
          ✕
        </button>
      </div>
    `;

    document.body.appendChild(messageElement);

    // 애니메이션으로 표시
    setTimeout(() => {
      messageElement.classList.remove("translate-x-full");
    }, 100);

    // 자동 제거
    setTimeout(() => {
      messageElement.classList.add("translate-x-full");
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageElement.parentNode.removeChild(messageElement);
        }

        this.isShowingMessage = false;

        // 큐에 대기 중인 메시지 처리
        if (this.messageQueue.length > 0) {
          const nextMessage = this.messageQueue.shift();
          setTimeout(() => this.displayMessage(nextMessage), 100);
        }
      }, 300);
    }, duration);
  }

  /**
   * 에러 표시
   * @param {Object} error - 에러 객체
   */
  showError(error) {
    this.showMessage(error.message || "오류가 발생했습니다.", "error", 5000);
  }

  /**
   * 상태 텍스트 업데이트
   * @param {string} text - 상태 텍스트
   */
  updateStatus(text) {
    if (this.elements.statusText) {
      this.elements.statusText.textContent = text;
    }
  }

  /**
   * 좌표 정보 업데이트
   * @param {Object} coordinates - 좌표 정보
   */
  updateCoordinates(coordinates) {
    if (this.elements.coordinateInfo && coordinates) {
      const { x, y, value } = coordinates;
      this.elements.coordinateInfo.textContent = `X: ${x}, Y: ${y}${
        value ? `, Value: ${value}` : ""
      }`;
    }
  }

  /**
   * 툴팁 표시
   * @param {HTMLElement} element - 대상 요소
   * @param {string} text - 툴팁 텍스트
   */
  showTooltip(element, text) {
    this.hideTooltip();

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.textContent = text;

    document.body.appendChild(tooltip);

    const rect = element.getBoundingClientRect();
    tooltip.style.left =
      rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + "px";
    tooltip.style.top = rect.bottom + 5 + "px";

    this.currentTooltip = tooltip;
  }

  /**
   * 툴팁 숨김
   */
  hideTooltip() {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
  }

  /**
   * 파일 크기 포맷팅
   * @param {number} bytes - 바이트 크기
   * @returns {string} 포맷된 크기
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * 드래그 오버 효과 추가
   */
  addDragOverEffect() {
    this.elements.dropZone?.classList.add("drag-active");
    appState.setState("isDragOver", true);
  }

  /**
   * 드래그 오버 효과 제거
   */
  removeDragOverEffect() {
    this.elements.dropZone?.classList.remove("drag-active");
    appState.setState("isDragOver", false);
  }

  /**
   * 반응형 레이아웃 조정
   */
  adjustResponsiveLayout() {
    const width = window.innerWidth;

    // 모바일 레이아웃 조정
    if (width < 768) {
      this.elements.header?.classList.add("mobile-header");
    } else {
      this.elements.header?.classList.remove("mobile-header");
    }
  }

  /**
   * 정리
   */
  cleanup() {
    // 메시지 큐 클리어
    this.messageQueue = [];

    // 툴팁 제거
    this.hideTooltip();

    // 진행률 숨김
    this.hideProgress();

    // 로딩 상태 해제
    this.setLoadingState(false);
  }
}

export default UIController;
