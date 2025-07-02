/**
 * 메인 애플리케이션 컨트롤러
 * 전체 애플리케이션의 초기화와 라우팅을 담당
 */

// 핵심 모듈 import - 경로 수정
import { appState } from "./core/appStateManager.js";
import { errorHandler } from "./core/errorHandler.js";
import { fileManager } from "./modules/fileManager.js";
import { measurementEngine } from "./modules/measurementEngine.js";
import { imageProcessor } from "./modules/imageProcessor.js";

// 컨트롤러 import
import { UIController } from "./controllers/uiController.js";
import { FileController } from "./controllers/fileController.js";
import { ViewerController } from "./controllers/viewerController.js";
import { ChartController } from "./controllers/chartController.js";
import { TableController } from "./controllers/tableController.js";

class DicomAnalyzerApp {
  constructor() {
    this.controllers = {};
    this.isInitialized = false;
    this.currentView = null;
    this.resizeTimeout = null;

    // 순환 참조 방지
    this._isViewChanging = false;
    this._pendingViewChange = null;
  }

  /**
   * 애플리케이션 초기화
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log("DICOM 분석기 초기화 중...");

      // 로컬 스토리지에서 이전 상태 복원
      appState.loadFromLocalStorage();

      // 컨트롤러 초기화
      await this.initializeControllers();

      // 이벤트 리스너 설정
      this.setupEventListeners();

      // 상태 구독 설정
      this.setupStateSubscriptions();

      // 초기 UI 상태 설정
      this.setupInitialUI();

      // 전역 에러 처리 설정
      this.setupGlobalErrorHandling();

      // 키보드 단축키 설정
      this.setupKeyboardShortcuts();

      this.isInitialized = true;
      console.log("DICOM 분석기 초기화 완료");

      // 초기화 완료 이벤트 발생
      appState.emit("app-initialized");
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "애플리케이션 초기화",
        userMessage:
          "애플리케이션을 시작할 수 없습니다. 페이지를 새로고침해주세요.",
      });
    }
  }

  /**
   * 컨트롤러 초기화
   */
  async initializeControllers() {
    // UI 컨트롤러 (가장 먼저 초기화)
    this.controllers.ui = new UIController();
    await this.controllers.ui.initialize();

    // 파일 컨트롤러
    this.controllers.file = new FileController();
    await this.controllers.file.initialize();

    // 차트 컨트롤러
    this.controllers.chart = new ChartController();
    await this.controllers.chart.initialize();

    // 테이블 컨트롤러
    this.controllers.table = new TableController();
    await this.controllers.table.initialize();

    // 뷰어 컨트롤러 (가장 복잡하므로 마지막에)
    this.controllers.viewer = new ViewerController();
    await this.controllers.viewer.initialize();

    console.log("모든 컨트롤러 초기화 완료");
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 윈도우 이벤트
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });

    window.addEventListener("resize", () => {
      this.handleWindowResize();
    });

    // 온라인/오프라인 상태 감지
    window.addEventListener("online", () => {
      appState.setState("isOnline", true);
      this.controllers.ui.showMessage(
        "인터넷 연결이 복원되었습니다.",
        "success"
      );
    });

    window.addEventListener("offline", () => {
      appState.setState("isOnline", false);
      this.controllers.ui.showMessage("인터넷 연결이 끊어졌습니다.", "warning");
    });

    // 파일 드래그 앤 드롭 방지 (전역)
    document.addEventListener("dragover", e => {
      e.preventDefault();
    });

    document.addEventListener("drop", e => {
      e.preventDefault();
    });
  }

  /**
   * 상태 구독 설정
   */
  setupStateSubscriptions() {
    // 현재 뷰 변경 감지 (순환 참조 방지)
    appState.subscribe("currentView", view => {
      if (!this._isViewChanging) {
        this.handleViewChange(view);
      }
    });

    // 로딩 상태 변경 감지
    appState.subscribe("isLoading", isLoading => {
      this.controllers.ui.setLoadingState(isLoading);
    });

    // 에러 상태 변경 감지
    appState.subscribe("error", error => {
      if (error) {
        this.controllers.ui.showError(error);
      }
    });

    // 파일 업로드 상태 변경 감지
    appState.subscribe("uploadedFile", file => {
      if (file) {
        // 다음 tick에서 처리하여 스택 오버플로우 방지
        setTimeout(() => {
          this.handleFileUploaded(file);
        }, 0);
      }
    });

    // DICOM 데이터 변경 감지
    appState.subscribe("dicomData", data => {
      if (data) {
        // 다음 tick에서 처리하여 스택 오버플로우 방지
        setTimeout(() => {
          this.handleDicomDataLoaded(data);
        }, 0);
      }
    });

    // 뷰어 상태 변경 시 로컬 스토리지 저장
    appState.subscribe("viewer", () => {
      // 디바운스 처리
      clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => {
        appState.saveToLocalStorage();
      }, 1000);
    });
  }

  /**
   * 초기 UI 상태 설정
   */
  setupInitialUI() {
    // 온라인 상태 확인
    appState.setState("isOnline", navigator.onLine);

    // 브라우저 지원 기능 확인
    const features = {
      fileAPI: !!window.File,
      canvas: !!document.createElement("canvas").getContext,
      webGL: !!document.createElement("canvas").getContext("webgl"),
      workers: !!window.Worker,
      indexedDB: !!window.indexedDB,
    };

    appState.setState("browserFeatures", features);

    // 지원하지 않는 브라우저인 경우 경고
    if (!features.fileAPI || !features.canvas) {
      this.controllers.ui.showError({
        type: "BROWSER_NOT_SUPPORTED",
        message:
          "이 브라우저는 필요한 기능을 지원하지 않습니다. 최신 브라우저를 사용해주세요.",
      });
    }

    // 초기 뷰 설정 (항상 welcome으로 시작)
    this.setView("welcome");
  }

  /**
   * 전역 에러 처리 설정
   */
  setupGlobalErrorHandling() {
    // 처리되지 않은 Promise rejection
    window.addEventListener("unhandledrejection", event => {
      errorHandler.handleError(event.reason, {
        context: "Unhandled Promise Rejection",
        silent: false,
      });
    });

    // 처리되지 않은 JavaScript 에러
    window.addEventListener("error", event => {
      errorHandler.handleError(event.error || new Error(event.message), {
        context: "JavaScript Error",
        silent: false,
      });
    });
  }

  /**
   * 키보드 단축키 설정
   */
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", e => {
      // Ctrl/Cmd + O: 파일 열기
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        this.controllers.file.selectFile();
      }

      // Ctrl/Cmd + S: 스크린샷 저장 (뷰어에서만)
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "s" &&
        this.currentView === "viewer"
      ) {
        e.preventDefault();
        this.controllers.viewer.saveScreenshot();
      }

      // ESC: 현재 작업 취소
      if (e.key === "Escape") {
        this.cancelCurrentOperation();
      }

      // F11: 전체화면 토글
      if (e.key === "F11") {
        e.preventDefault();
        this.toggleFullscreen();
      }

      // 뷰어에서의 단축키
      if (this.currentView === "viewer") {
        this.handleViewerShortcuts(e);
      }
    });
  }

  /**
   * 뷰어 단축키 처리
   * @param {KeyboardEvent} e - 키보드 이벤트
   */
  handleViewerShortcuts(e) {
    switch (e.key) {
      case "1":
        this.controllers.viewer.setMeasurementMode("distance");
        break;
      case "2":
        this.controllers.viewer.setMeasurementMode("angle");
        break;
      case "3":
        this.controllers.viewer.setMeasurementMode("area");
        break;
      case "r":
        this.controllers.viewer.resetImage();
        break;
      case "f":
        this.controllers.viewer.fitToWindow();
        break;
      case "+":
      case "=":
        e.preventDefault();
        this.controllers.viewer.zoomIn();
        break;
      case "-":
        e.preventDefault();
        this.controllers.viewer.zoomOut();
        break;
    }
  }

  /**
   * 뷰 변경 처리 (순환 참조 방지)
   * @param {string} view - 새로운 뷰
   */
  async handleViewChange(view) {
    if (this.currentView === view || this._isViewChanging) {
      return;
    }

    // 대기 중인 뷰 변경이 있으면 저장
    if (this._isViewChanging) {
      this._pendingViewChange = view;
      return;
    }

    this._isViewChanging = true;

    try {
      // 이전 뷰 정리
      if (
        this.currentView &&
        this.currentView !== "welcome" &&
        this.controllers[this.currentView]
      ) {
        await this.controllers[this.currentView].deactivate();
      }

      // 새 뷰 활성화
      this.currentView = view;

      if (view === "welcome") {
        this.controllers.ui.showWelcomeScreen();
      } else if (this.controllers[view]) {
        this.controllers.ui.showView(view);
        await this.controllers[view].activate();
      }

      // UI 업데이트
      this.controllers.ui.updateViewButtons(view);
    } catch (error) {
      await errorHandler.handleError(error, {
        context: `뷰 변경 (${view})`,
      });
    } finally {
      this._isViewChanging = false;

      // 대기 중인 뷰 변경 처리
      if (this._pendingViewChange) {
        const pendingView = this._pendingViewChange;
        this._pendingViewChange = null;
        setTimeout(() => {
          this.setView(pendingView);
        }, 0);
      }
    }
  }

  /**
   * 파일 업로드 완료 처리
   * @param {File} file - 업로드된 파일
   */
  async handleFileUploaded(file) {
    try {
      // 파일 정보 표시
      this.controllers.ui.showFileInfo(file);

      // 뷰 버튼 활성화
      this.controllers.ui.enableViewButtons();

      // 자동으로 차트 뷰로 전환 (순환 참조 방지)
      await this.setView("chart");
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "파일 업로드 후 처리",
      });
    }
  }

  /**
   * DICOM 데이터 로드 완료 처리
   * @param {Object} data - DICOM 데이터
   */
  async handleDicomDataLoaded(data) {
    try {
      // 측정 엔진에 픽셀 간격 설정
      if (data.image_info && data.image_info.pixel_spacing) {
        measurementEngine.setPixelSpacing(data.image_info.pixel_spacing);
      }

      // 각 컨트롤러에 데이터 전달 (병렬 처리 대신 순차 처리로 안정성 확보)
      await this.controllers.chart.loadData(data);
      await this.controllers.table.loadData(data);
      await this.controllers.viewer.loadData(data);

      console.log("DICOM 데이터 로드 완료");
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "DICOM 데이터 처리",
      });
    }
  }

  /**
   * 윈도우 리사이즈 처리
   */
  handleWindowResize() {
    // 디바운스 처리
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      // 현재 활성화된 컨트롤러에 리사이즈 이벤트 전달
      if (this.currentView && this.controllers[this.currentView]) {
        this.controllers[this.currentView].handleResize?.();
      }
    }, 250);
  }

  /**
   * 현재 작업 취소
   */
  cancelCurrentOperation() {
    // 로딩 중인 작업 취소
    if (appState.getState("isLoading")) {
      appState.setState("isLoading", false);
    }

    // 측정 모드 해제
    if (this.currentView === "viewer") {
      this.controllers.viewer.cancelMeasurement();
    }

    // 에러 모달 닫기
    const errorModal = document.querySelector(".error-modal");
    if (errorModal) {
      errorModal.remove();
    }
  }

  /**
   * 전체화면 토글
   */
  async toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn("전체화면 전환 실패:", error);
    }
  }

  /**
   * 뷰 설정 (순환 참조 방지)
   * @param {string} view - 설정할 뷰
   */
  async setView(view) {
    // 이미 같은 뷰이거나 변경 중이면 무시
    if (this.currentView === view || this._isViewChanging) {
      return;
    }

    // 상태 업데이트는 다음 tick에서 처리
    setTimeout(() => {
      appState.setState("currentView", view);
    }, 0);
  }

  /**
   * 애플리케이션 상태 덤프 (디버깅용)
   */
  dumpState() {
    return {
      appState: appState.dump(),
      currentView: this.currentView,
      controllers: Object.keys(this.controllers),
      measurements: measurementEngine.getAllMeasurements(),
      isInitialized: this.isInitialized,
      isViewChanging: this._isViewChanging,
      pendingViewChange: this._pendingViewChange,
    };
  }

  /**
   * 정리 (메모리 해제)
   */
  cleanup() {
    console.log("애플리케이션 정리 중...");

    // 뷰 변경 상태 초기화
    this._isViewChanging = false;
    this._pendingViewChange = null;

    // 컨트롤러 정리
    Object.values(this.controllers).forEach(controller => {
      controller.cleanup?.();
    });

    // 모듈 정리
    fileManager.cleanup?.();
    measurementEngine.cleanup();
    imageProcessor.cleanup?.();

    // 타이머 정리
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // 상태 저장
    appState.saveToLocalStorage();

    console.log("애플리케이션 정리 완료");
  }
}

// 애플리케이션 인스턴스 생성 및 초기화
const app = new DicomAnalyzerApp();

// DOM 로드 완료 시 초기화
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    app.initialize();
  });
} else {
  app.initialize();
}

// 개발 모드에서 전역 객체에 추가
if (window.ENV?.NODE_ENV === "development") {
  window.app = app;
  window.appState = appState;
  window.errorHandler = errorHandler;

  // 디버깅 도구
  window.debug = {
    dumpState: () => app.dumpState(),
    triggerError: message => {
      throw new Error(message || "Test error");
    },
    clearStorage: () => {
      localStorage.clear();
      sessionStorage.clear();
      console.log("Storage cleared");
    },
    resetApp: () => {
      appState.reset();
      location.reload();
    },
  };

  console.log("🔧 개발 모드: window.app, window.debug 사용 가능");
}

export default app;
