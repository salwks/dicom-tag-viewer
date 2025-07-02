/**
 * controllers/viewer/BaseViewerController.js
 * 기본 뷰어 컨트롤러 - 다른 모든 뷰어 모듈의 베이스
 */

import { appState } from "../../core/appStateManager.js";
import { errorHandler } from "../../core/errorHandler.js";

export class BaseViewerController {
  constructor() {
    this.elements = {};
    this.canvases = {};
    this.isInitialized = false;
    this.modules = new Map();

    // 기본 상태
    this.state = {
      isActive: false,
      imageData: null,
      containerSize: { width: 0, height: 0 },
    };

    // 무한 재귀 방지를 위한 플래그들
    this._isLoadingImage = false;
    this._isBroadcasting = false;
    this._stateSubscribed = false;
  }

  /**
   * 초기화
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log("BaseViewerController 초기화 시작");

      // DOM 요소 캐싱
      this.cacheElements();

      // 캔버스 설정
      this.setupCanvases();

      // 기본 이벤트 리스너 설정
      this.setupBaseEventListeners();

      // 모듈 등록을 위한 이벤트 발생
      appState.emit("viewer-base-ready", this);

      this.isInitialized = true;
      console.log("BaseViewerController 초기화 완료");
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "BaseViewerController 초기화",
      });
    }
  }

  /**
   * DOM 요소 캐싱
   */
  cacheElements() {
    this.elements = {
      // 메인 컨테이너
      viewerView: document.getElementById("viewerView"),
      imageContainer: document.getElementById("imageContainer"),
      viewerControls: document.getElementById("viewerControls"),

      // 캔버스들
      imageCanvas: document.getElementById("imageCanvas"),
      measurementCanvas: document.getElementById("measurementCanvas"),

      // 정보 표시
      imageInfo: document.getElementById("imageInfo"),
      pixelInfo: document.getElementById("pixelInfo"),
      zoomIndicator: document.getElementById("zoomIndicator"),
    };

    // 요소 존재 확인
    const missingElements = Object.entries(this.elements)
      .filter(([key, element]) => !element)
      .map(([key]) => key);

    if (missingElements.length > 0) {
      console.warn("누락된 DOM 요소들:", missingElements);
    }
  }

  /**
   * 캔버스 설정
   */
  setupCanvases() {
    if (!this.elements.imageCanvas || !this.elements.measurementCanvas) {
      throw new Error("필수 캔버스 요소를 찾을 수 없습니다.");
    }

    this.canvases = {
      image: this.elements.imageCanvas,
      imageCtx: this.elements.imageCanvas.getContext("2d"),
      measurement: this.elements.measurementCanvas,
      measurementCtx: this.elements.measurementCanvas.getContext("2d"),
    };

    // 캔버스 기본 설정
    this.canvases.imageCtx.imageSmoothingEnabled = false;
    this.canvases.measurementCtx.imageSmoothingEnabled = false;

    console.log("캔버스 설정 완료");
  }

  /**
   * 기본 이벤트 리스너 설정
   */
  setupBaseEventListeners() {
    // 윈도우 리사이즈
    window.addEventListener("resize", () => {
      this.handleResize();
    });

    // 상태 변경 구독 (한 번만 설정)
    if (!this._stateSubscribed) {
      appState.subscribe("currentView", view => {
        if (view === "viewer") {
          this.activate();
        } else if (this.state.isActive) {
          this.deactivate();
        }
      });
      this._stateSubscribed = true;
    }

    console.log("기본 이벤트 리스너 설정 완료");
  }

  /**
   * 모듈 등록
   */
  registerModule(name, module) {
    if (this.modules.has(name)) {
      console.warn(`모듈 '${name}'이 이미 등록되어 있습니다.`);
      return;
    }

    this.modules.set(name, module);

    // 모듈에 베이스 컨트롤러 참조 제공
    if (typeof module.setBaseController === "function") {
      module.setBaseController(this);
    }

    console.log(`모듈 '${name}' 등록 완료`);
  }

  /**
   * 모듈 가져오기
   */
  getModule(name) {
    return this.modules.get(name);
  }

  /**
   * 모든 모듈에 이벤트 전파
   */
  broadcastToModules(eventName, data) {
    // 이미 브로드캐스팅 중이면 중단 (무한 재귀 방지)
    if (this._isBroadcasting) {
      console.warn(`브로드캐스트 중복 호출 방지: ${eventName}`);
      return;
    }

    this._isBroadcasting = true;

    try {
      this.modules.forEach((module, name) => {
        if (typeof module[eventName] === "function") {
          try {
            module[eventName](data);
          } catch (error) {
            console.error(
              `모듈 '${name}'의 '${eventName}' 처리 중 오류:`,
              error
            );
            // 에러가 발생해도 다른 모듈들은 계속 처리
          }
        }
      });
    } finally {
      // 비동기로 플래그 해제
      setTimeout(() => {
        this._isBroadcasting = false;
      }, 0);
    }
  }

  /**
   * 뷰 활성화
   */
  async activate() {
    if (this.state.isActive) return;

    try {
      console.log("뷰어 활성화");

      // 뷰 표시
      if (this.elements.viewerView) {
        this.elements.viewerView.classList.remove("hidden");
      }

      // 캔버스 크기 업데이트
      this.updateCanvasSize();

      // 모든 모듈에 활성화 알림
      this.broadcastToModules("onActivate");

      this.state.isActive = true;
      appState.setState("viewer.isActive", true);
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "뷰어 활성화",
      });
    }
  }

  /**
   * 뷰 비활성화
   */
  async deactivate() {
    if (!this.state.isActive) return;

    try {
      console.log("뷰어 비활성화");

      // 상태를 먼저 변경하여 재귀 호출 방지
      this.state.isActive = false;

      // 뷰 숨김
      if (this.elements.viewerView) {
        this.elements.viewerView.classList.add("hidden");
      }

      // 모든 모듈에 비활성화 알림
      this.broadcastToModules("onDeactivate");

      // 상태 업데이트는 마지막에
      appState.setState("viewer.isActive", false);
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "뷰어 비활성화",
      });
    }
  }

  /**
   * 이미지 데이터 로드
   */
  async loadImageData(imageData) {
    // 이미 로드 중이면 중단 (무한 재귀 방지)
    if (this._isLoadingImage) {
      console.warn("이미지 로드 중복 호출 방지");
      return;
    }

    this._isLoadingImage = true;

    try {
      this.state.imageData = imageData;

      // 캔버스 크기 업데이트
      this.updateCanvasSize();

      // 상태 업데이트
      appState.setState("viewer.imageLoaded", true);
      console.log("이미지 데이터 로드 완료:", imageData);

      // 모든 모듈에 이미지 로드 알림 (더 긴 지연으로 안전하게)
      setTimeout(() => {
        this.broadcastToModules("onImageLoaded", imageData);
        this._isLoadingImage = false;
      }, 100);
    } catch (error) {
      this._isLoadingImage = false;
      await errorHandler.handleError(error, {
        context: "이미지 데이터 로드",
      });
    }
  }

  /**
   * 캔버스 크기 업데이트
   */
  updateCanvasSize() {
    if (!this.elements.imageContainer) return;

    const container = this.elements.imageContainer;
    const rect = container.getBoundingClientRect();

    const width = rect.width;
    const height = rect.height;

    // 컨테이너 크기 상태 업데이트
    this.state.containerSize = { width, height };

    // 모든 캔버스 크기 설정
    Object.values(this.canvases).forEach(canvas => {
      if (canvas && canvas.width !== undefined) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
      }
    });

    // 모듈들에게 크기 변경 알림
    this.broadcastToModules("onCanvasResize", { width, height });

    console.log(`캔버스 크기 업데이트: ${width}x${height}`);
  }

  /**
   * 리사이즈 처리
   */
  handleResize() {
    if (!this.state.isActive) return;

    // 디바운스 처리
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.updateCanvasSize();
    }, 100);
  }

  /**
   * 좌표 변환 유틸리티
   */
  screenToCanvas(screenX, screenY) {
    if (!this.elements.imageContainer) return { x: 0, y: 0 };

    const rect = this.elements.imageContainer.getBoundingClientRect();
    return {
      x: screenX - rect.left,
      y: screenY - rect.top,
    };
  }

  /**
   * 캔버스 클리어
   */
  clearCanvas(canvasName = "all") {
    if (canvasName === "all") {
      Object.values(this.canvases).forEach(ctx => {
        if (ctx && ctx.clearRect) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
      });
    } else if (this.canvases[canvasName + "Ctx"]) {
      const ctx = this.canvases[canvasName + "Ctx"];
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }

  /**
   * 상태 정보 가져오기
   */
  getState() {
    return {
      ...this.state,
      modules: Array.from(this.modules.keys()),
      canvasSize: this.state.containerSize,
    };
  }

  /**
   * 정리
   */
  cleanup() {
    try {
      console.log("BaseViewerController 정리 시작");

      // 모든 모듈 정리
      this.modules.forEach((module, name) => {
        if (typeof module.cleanup === "function") {
          try {
            module.cleanup();
          } catch (error) {
            console.error(`모듈 '${name}' 정리 중 오류:`, error);
          }
        }
      });

      // 모듈 맵 클리어
      this.modules.clear();

      // 타이머 정리
      if (this.resizeTimeout) {
        clearTimeout(this.resizeTimeout);
      }

      // 상태 초기화
      this.state = {
        isActive: false,
        imageData: null,
        containerSize: { width: 0, height: 0 },
      };

      this.isInitialized = false;
      console.log("BaseViewerController 정리 완료");
    } catch (error) {
      console.error("BaseViewerController 정리 중 오류:", error);
    }
  }
}

export default BaseViewerController;
