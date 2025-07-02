/**
 * controllers/viewer/InteractionModule.js
 * 마우스/키보드 상호작용 담당 모듈
 */

import { appState } from "../../core/appStateManager.js";
import { errorHandler } from "../../core/errorHandler.js";

export class InteractionModule {
  constructor() {
    this.baseController = null;
    this.imageDisplayModule = null;

    // 상호작용 상태
    this.state = {
      mode: "select", // 'select', 'pan', 'zoom'
      isDragging: false,
      dragStart: null,
      lastMousePos: null,
      isEnabled: true,
    };

    // 이벤트 리스너 참조 (제거용)
    this.boundEventListeners = {};
  }

  /**
   * 베이스 컨트롤러 설정
   */
  setBaseController(baseController) {
    this.baseController = baseController;
    this.setupEventListeners();
  }

  /**
   * 이미지 표시 모듈 설정
   */
  setImageDisplayModule(imageDisplayModule) {
    this.imageDisplayModule = imageDisplayModule;
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    if (!this.baseController?.elements.imageContainer) return;

    const container = this.baseController.elements.imageContainer;

    // 바운드된 이벤트 리스너 생성
    this.boundEventListeners = {
      mousedown: e => this.handleMouseDown(e),
      mousemove: e => this.handleMouseMove(e),
      mouseup: e => this.handleMouseUp(e),
      mouseleave: e => this.handleMouseLeave(e),
      wheel: e => this.handleWheel(e),
      contextmenu: e => this.handleContextMenu(e),
      click: e => this.handleClick(e),
    };

    // 이벤트 리스너 등록
    Object.entries(this.boundEventListeners).forEach(([event, handler]) => {
      container.addEventListener(event, handler);
    });

    // 키보드 이벤트 (전역)
    this.boundEventListeners.keydown = e => this.handleKeyDown(e);
    document.addEventListener("keydown", this.boundEventListeners.keydown);

    console.log("InteractionModule 이벤트 리스너 설정 완료");
  }

  /**
   * 상호작용 모드 설정
   */
  setMode(mode) {
    this.state.mode = mode;
    this.updateCursor();

    appState.setState("viewer.interactionMode", mode);
    console.log("상호작용 모드 변경:", mode);
  }

  /**
   * 마우스 다운 처리
   */
  handleMouseDown(e) {
    if (!this.state.isEnabled || !this.imageDisplayModule?.imageData) return;

    e.preventDefault();

    this.state.isDragging = true;
    this.state.dragStart = { x: e.clientX, y: e.clientY };
    this.state.lastMousePos = { x: e.clientX, y: e.clientY };

    // 모드별 처리
    switch (this.state.mode) {
      case "pan":
        this.startPanning();
        break;
      case "select":
        this.handleSelectionStart(e);
        break;
    }

    // 다른 모듈들에게 알림
    this.broadcastInteraction("mousedown", {
      originalEvent: e,
      canvasCoords: this.getCanvasCoords(e),
      imageCoords: this.getImageCoords(e),
      mode: this.state.mode,
    });
  }

  /**
   * 마우스 이동 처리
   */
  handleMouseMove(e) {
    if (!this.state.isEnabled) return;

    // 픽셀 정보 업데이트
    this.updatePixelInfo(e);

    // 드래그 중인 경우
    if (this.state.isDragging) {
      switch (this.state.mode) {
        case "pan":
          this.handlePanning(e);
          break;
        case "select":
          this.handleSelectionMove(e);
          break;
      }
    }

    // 다른 모듈들에게 알림
    this.broadcastInteraction("mousemove", {
      originalEvent: e,
      canvasCoords: this.getCanvasCoords(e),
      imageCoords: this.getImageCoords(e),
      isDragging: this.state.isDragging,
      mode: this.state.mode,
    });
  }

  /**
   * 마우스 업 처리
   */
  handleMouseUp(e) {
    if (!this.state.isEnabled) return;

    const wasDragging = this.state.isDragging;

    this.state.isDragging = false;
    this.state.lastMousePos = null;

    // 모드별 처리
    switch (this.state.mode) {
      case "pan":
        this.endPanning();
        break;
      case "select":
        this.handleSelectionEnd(e);
        break;
    }

    // 다른 모듈들에게 알림
    this.broadcastInteraction("mouseup", {
      originalEvent: e,
      canvasCoords: this.getCanvasCoords(e),
      imageCoords: this.getImageCoords(e),
      wasDragging,
      mode: this.state.mode,
    });

    this.updateCursor();
  }

  /**
   * 마우스 리브 처리
   */
  handleMouseLeave(e) {
    this.handleMouseUp(e);
    this.hidePixelInfo();
  }

  /**
   * 휠 처리 (줌)
   */
  handleWheel(e) {
    if (!this.state.isEnabled || !this.imageDisplayModule?.imageData) return;

    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const canvasCoords = this.getCanvasCoords(e);

    this.zoomAtPoint(delta, canvasCoords.x, canvasCoords.y);

    // 다른 모듈들에게 알림
    this.broadcastInteraction("wheel", {
      originalEvent: e,
      delta,
      canvasCoords,
      imageCoords: this.getImageCoords(e),
    });
  }

  /**
   * 우클릭 처리
   */
  handleContextMenu(e) {
    e.preventDefault();

    // 다른 모듈들에게 알림
    this.broadcastInteraction("contextmenu", {
      originalEvent: e,
      canvasCoords: this.getCanvasCoords(e),
      imageCoords: this.getImageCoords(e),
    });
  }

  /**
   * 클릭 처리
   */
  handleClick(e) {
    if (!this.state.isEnabled) return;

    // 드래그였다면 클릭으로 처리하지 않음
    if (this.state.dragStart) {
      const dx = e.clientX - this.state.dragStart.x;
      const dy = e.clientY - this.state.dragStart.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 3) return; // 3픽셀 이상 이동했으면 드래그로 간주
    }

    // 다른 모듈들에게 알림
    this.broadcastInteraction("click", {
      originalEvent: e,
      canvasCoords: this.getCanvasCoords(e),
      imageCoords: this.getImageCoords(e),
      mode: this.state.mode,
    });
  }

  /**
   * 키보드 처리
   */
  handleKeyDown(e) {
    if (!this.state.isEnabled || !this.baseController?.state.isActive) return;

    // 기본 단축키 처리
    switch (e.key) {
      case "p":
      case "P":
        this.togglePanMode();
        e.preventDefault();
        break;
      case "+":
      case "=":
        this.zoom(1.2);
        e.preventDefault();
        break;
      case "-":
        this.zoom(0.8);
        e.preventDefault();
        break;
      case "f":
      case "F":
        this.fitToWindow();
        e.preventDefault();
        break;
      case "r":
      case "R":
        this.resetView();
        e.preventDefault();
        break;
      case "Escape":
        this.cancelCurrentAction();
        e.preventDefault();
        break;
    }

    // 다른 모듈들에게 알림
    this.broadcastInteraction("keydown", {
      originalEvent: e,
      key: e.key,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
    });
  }

  /**
   * 패닝 시작
   */
  startPanning() {
    this.updateCursor();
  }

  /**
   * 패닝 처리
   */
  handlePanning(e) {
    if (!this.state.lastMousePos || !this.imageDisplayModule) return;

    const dx = e.clientX - this.state.lastMousePos.x;
    const dy = e.clientY - this.state.lastMousePos.y;

    const currentTransform = this.imageDisplayModule.transform;

    this.imageDisplayModule.applyTransform({
      translateX: currentTransform.translateX + dx / currentTransform.scale,
      translateY: currentTransform.translateY + dy / currentTransform.scale,
    });

    this.state.lastMousePos = { x: e.clientX, y: e.clientY };
  }

  /**
   * 패닝 종료
   */
  endPanning() {
    this.updateCursor();
  }

  /**
   * 선택 시작 처리
   */
  handleSelectionStart(e) {
    // 측정 모듈 등에서 처리할 수 있도록 이벤트 전파
  }

  /**
   * 선택 이동 처리
   */
  handleSelectionMove(e) {
    // 측정 모듈 등에서 처리할 수 있도록 이벤트 전파
  }

  /**
   * 선택 종료 처리
   */
  handleSelectionEnd(e) {
    // 측정 모듈 등에서 처리할 수 있도록 이벤트 전파
  }

  /**
   * 특정 지점에서 줌
   */
  zoomAtPoint(factor, pointX, pointY) {
    if (!this.imageDisplayModule?.imageData) return;

    const currentTransform = this.imageDisplayModule.transform;
    const oldScale = currentTransform.scale;
    const newScale = Math.max(0.1, Math.min(5, oldScale * factor));

    if (newScale === oldScale) return;

    const canvas = this.baseController.canvases.image;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // 줌 포인트를 이미지 좌표로 변환
    const imageX =
      (pointX - centerX) / oldScale -
      currentTransform.translateX +
      this.imageDisplayModule.imageData.width / 2;
    const imageY =
      (pointY - centerY) / oldScale -
      currentTransform.translateY +
      this.imageDisplayModule.imageData.height / 2;

    // 새로운 변환 계산
    const newTranslateX =
      (pointX - centerX) / newScale -
      imageX +
      this.imageDisplayModule.imageData.width / 2;
    const newTranslateY =
      (pointY - centerY) / newScale -
      imageY +
      this.imageDisplayModule.imageData.height / 2;

    this.imageDisplayModule.applyTransform({
      scale: newScale,
      translateX: newTranslateX,
      translateY: newTranslateY,
    });
  }

  /**
   * 중앙 기준 줌
   */
  zoom(factor) {
    if (!this.baseController?.canvases.image) return;

    const canvas = this.baseController.canvases.image;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    this.zoomAtPoint(factor, centerX, centerY);
  }

  /**
   * 화면에 맞춤
   */
  fitToWindow() {
    if (this.imageDisplayModule) {
      this.imageDisplayModule.fitToCanvas();
    }
  }

  /**
   * 뷰 초기화
   */
  resetView() {
    if (this.imageDisplayModule) {
      this.imageDisplayModule.resetTransform();
    }
  }

  /**
   * 패닝 모드 토글
   */
  togglePanMode() {
    const newMode = this.state.mode === "pan" ? "select" : "pan";
    this.setMode(newMode);
  }

  /**
   * 현재 작업 취소
   */
  cancelCurrentAction() {
    if (this.state.isDragging) {
      this.handleMouseUp({ clientX: 0, clientY: 0 });
    }

    // 다른 모듈들에게 취소 알림
    this.broadcastInteraction("cancel", {});
  }

  /**
   * 커서 업데이트
   */
  updateCursor() {
    const container = this.baseController?.elements.imageContainer;
    if (!container) return;

    let cursor = "default";

    switch (this.state.mode) {
      case "pan":
        cursor = this.state.isDragging ? "grabbing" : "grab";
        break;
      case "select":
        cursor = "default";
        break;
      case "zoom":
        cursor = "zoom-in";
        break;
    }

    container.style.cursor = cursor;
  }

  /**
   * 픽셀 정보 업데이트
   */
  updatePixelInfo(e) {
    const pixelInfo = this.baseController?.elements.pixelInfo;
    if (!pixelInfo || !this.imageDisplayModule?.imageData) return;

    try {
      const imageCoords = this.getImageCoords(e);

      if (imageCoords && !isNaN(imageCoords.x) && !isNaN(imageCoords.y)) {
        pixelInfo.textContent = `X: ${imageCoords.x}, Y: ${imageCoords.y}`;
        pixelInfo.style.left = e.clientX + 10 + "px";
        pixelInfo.style.top = e.clientY - 30 + "px";
        pixelInfo.classList.remove("hidden");
      } else {
        this.hidePixelInfo();
      }
    } catch (error) {
      this.hidePixelInfo();
    }
  }

  /**
   * 픽셀 정보 숨김
   */
  hidePixelInfo() {
    const pixelInfo = this.baseController?.elements.pixelInfo;
    if (pixelInfo) {
      pixelInfo.classList.add("hidden");
    }
  }

  /**
   * 캔버스 좌표 가져오기
   */
  getCanvasCoords(e) {
    return this.baseController
      ? this.baseController.screenToCanvas(e.clientX, e.clientY)
      : { x: 0, y: 0 };
  }

  /**
   * 이미지 좌표 가져오기
   */
  getImageCoords(e) {
    if (!this.imageDisplayModule) return { x: 0, y: 0 };

    const canvasCoords = this.getCanvasCoords(e);
    return this.imageDisplayModule.canvasToImageCoords(
      canvasCoords.x,
      canvasCoords.y
    );
  }

  /**
   * 다른 모듈들에게 상호작용 이벤트 전파
   */
  broadcastInteraction(eventType, data) {
    if (this.baseController) {
      // 비동기로 처리하여 무한 재귀 방지
      setTimeout(() => {
        this.baseController.broadcastToModules(
          `onInteraction_${eventType}`,
          data
        );
      }, 1);
    }
  }

  /**
   * 모듈 이벤트 핸들러
   */
  onActivate() {
    this.state.isEnabled = true;
    this.updateCursor();
  }

  onDeactivate() {
    this.state.isEnabled = false;
    if (this.state.isDragging) {
      this.state.isDragging = false;
      this.state.lastMousePos = null;
    }
    this.hidePixelInfo();
  }

  onImageLoaded(imageData) {
    // 이미지 로드 시 필요한 초기화
    this.state.isDragging = false;
    this.state.lastMousePos = null;
  }

  /**
   * 현재 상태 가져오기
   */
  getState() {
    return {
      mode: this.state.mode,
      isDragging: this.state.isDragging,
      isEnabled: this.state.isEnabled,
    };
  }

  /**
   * 정리
   */
  cleanup() {
    // 이벤트 리스너 제거
    if (this.baseController?.elements.imageContainer) {
      const container = this.baseController.elements.imageContainer;

      Object.entries(this.boundEventListeners).forEach(([event, handler]) => {
        if (event === "keydown") {
          document.removeEventListener(event, handler);
        } else {
          container.removeEventListener(event, handler);
        }
      });
    }

    // 상태 초기화
    this.state = {
      mode: "select",
      isDragging: false,
      dragStart: null,
      lastMousePos: null,
      isEnabled: true,
    };

    this.boundEventListeners = {};

    console.log("InteractionModule 정리 완료");
  }
}

export default InteractionModule;
