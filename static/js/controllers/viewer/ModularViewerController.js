/**
 * controllers/viewer/ModularViewerController.js
 * 모든 뷰어 모듈을 통합 관리하는 메인 컨트롤러
 */

import { appState } from "../../core/appStateManager.js";
import { errorHandler } from "../../core/errorHandler.js";

// 모듈 import
import BaseViewerController from "./BaseViewerController.js";
import ImageDisplayModule from "./ImageDisplayModule.js";
import InteractionModule from "./InteractionModule.js";
import MeasurementModule from "./MeasurementModule.js";
import ControlsModule from "./ControlsModule.js";

export class ModularViewerController {
  constructor() {
    this.baseController = null;
    this.modules = {};
    this.isInitialized = false;
  }

  /**
   * 초기화
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log("ModularViewerController 초기화 시작");

      // 베이스 컨트롤러 초기화
      await this.initializeBaseController();

      // 모듈들 초기화
      await this.initializeModules();

      // 모듈 간 연결 설정
      this.setupModuleConnections();

      // 베이스 컨트롤러에 모듈들 등록
      this.registerModules();

      this.isInitialized = true;
      console.log("ModularViewerController 초기화 완료");
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "ModularViewerController 초기화",
      });
    }
  }

  /**
   * 베이스 컨트롤러 초기화
   */
  async initializeBaseController() {
    this.baseController = new BaseViewerController();
    await this.baseController.initialize();
  }

  /**
   * 모듈들 초기화
   */
  async initializeModules() {
    // 각 모듈 인스턴스 생성
    this.modules = {
      imageDisplay: new ImageDisplayModule(),
      interaction: new InteractionModule(),
      measurement: new MeasurementModule(),
      controls: new ControlsModule(),
    };

    // 각 모듈에 베이스 컨트롤러 설정
    Object.values(this.modules).forEach(module => {
      if (typeof module.setBaseController === "function") {
        module.setBaseController(this.baseController);
      }
    });

    console.log("모든 모듈 초기화 완료");
  }

  /**
   * 모듈 간 연결 설정
   */
  setupModuleConnections() {
    const { imageDisplay, interaction, measurement, controls } = this.modules;

    // 상호작용 모듈에 이미지 표시 모듈 연결
    if (interaction.setImageDisplayModule) {
      interaction.setImageDisplayModule(imageDisplay);
    }

    // 측정 모듈에 이미지 표시 모듈 연결
    if (measurement.setImageDisplayModule) {
      measurement.setImageDisplayModule(imageDisplay);
    }

    // 컨트롤 모듈에 다른 모듈들 연결
    if (controls.setImageDisplayModule) {
      controls.setImageDisplayModule(imageDisplay);
    }
    if (controls.setInteractionModule) {
      controls.setInteractionModule(interaction);
    }

    console.log("모듈 간 연결 설정 완료");
  }

  /**
   * 베이스 컨트롤러에 모듈들 등록
   */
  registerModules() {
    Object.entries(this.modules).forEach(([name, module]) => {
      this.baseController.registerModule(name, module);
    });
  }

  /**
   * 뷰 활성화
   */
  async activate() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.baseController) {
      await this.baseController.activate();
    }
  }

  /**
   * 뷰 비활성화
   */
  async deactivate() {
    if (this.baseController && this.baseController.state.isActive) {
      await this.baseController.deactivate();
    }
  }

  /**
   * 데이터 로드
   */
  async loadData(data) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // 컨트롤 모듈에 이미지 정보 표시
      if (this.modules.controls) {
        this.modules.controls.displayImageInfo(data);
      }

      // 픽셀 간격 설정 (측정용)
      if (data.image_info?.pixel_spacing) {
        const measurementEngine = await import(
          "../../modules/measurementEngine.js"
        );
        measurementEngine.measurementEngine.setPixelSpacing(
          data.image_info.pixel_spacing
        );
      }

      console.log("뷰어 데이터 로드 완료");
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "뷰어 데이터 로드",
      });
    }
  }

  /**
   * 특정 모듈 가져오기
   */
  getModule(name) {
    return this.modules[name] || this.baseController?.getModule(name);
  }

  /**
   * 측정 모드 설정 (외부 API)
   */
  setMeasurementMode(mode) {
    const measurementModule = this.getModule("measurement");
    if (measurementModule) {
      measurementModule.setMeasurementMode(mode);
    }
  }

  /**
   * 상호작용 모드 설정 (외부 API)
   */
  setInteractionMode(mode) {
    const interactionModule = this.getModule("interaction");
    if (interactionModule) {
      interactionModule.setMode(mode);
    }
  }

  /**
   * 줌 제어 (외부 API)
   */
  zoomIn() {
    const interactionModule = this.getModule("interaction");
    if (interactionModule) {
      interactionModule.zoom(1.2);
    }
  }

  zoomOut() {
    const interactionModule = this.getModule("interaction");
    if (interactionModule) {
      interactionModule.zoom(0.8);
    }
  }

  setZoom(scale) {
    const imageDisplayModule = this.getModule("imageDisplay");
    if (imageDisplayModule) {
      imageDisplayModule.applyTransform({ scale });
    }
  }

  fitToWindow() {
    const interactionModule = this.getModule("interaction");
    if (interactionModule) {
      interactionModule.fitToWindow();
    }
  }

  /**
   * 이미지 조정 (외부 API)
   */
  setBrightness(value) {
    const controlsModule = this.getModule("controls");
    if (controlsModule) {
      controlsModule.setBrightness(value);
    }
  }

  setContrast(value) {
    const controlsModule = this.getModule("controls");
    if (controlsModule) {
      controlsModule.setContrast(value);
    }
  }

  resetImage() {
    const controlsModule = this.getModule("controls");
    if (controlsModule) {
      controlsModule.resetImage();
    }
  }

  /**
   * 측정 관련 (외부 API)
   */
  clearMeasurements() {
    const measurementModule = this.getModule("measurement");
    if (measurementModule) {
      measurementModule.clearAllMeasurements();
    }
  }

  cancelMeasurement() {
    const measurementModule = this.getModule("measurement");
    if (measurementModule) {
      measurementModule.cancelCurrentMeasurement();
    }
  }

  /**
   * 스크린샷 저장 (외부 API)
   */
  async saveScreenshot() {
    try {
      if (!this.baseController?.canvases.image) return;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const imageCanvas = this.baseController.canvases.image;
      const measurementCanvas = this.baseController.canvases.measurement;

      canvas.width = imageCanvas.width;
      canvas.height = imageCanvas.height;

      // 이미지 그리기
      ctx.drawImage(imageCanvas, 0, 0);

      // 측정 오버레이 그리기
      if (measurementCanvas) {
        ctx.drawImage(measurementCanvas, 0, 0);
      }

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `dicom_screenshot_${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "스크린샷 저장",
      });
    }
  }

  /**
   * 뷰어 상태 가져오기
   */
  getState() {
    const state = {
      isInitialized: this.isInitialized,
      baseController: this.baseController?.getState(),
      modules: {},
    };

    // 각 모듈의 상태 수집
    Object.entries(this.modules).forEach(([name, module]) => {
      if (typeof module.getState === "function") {
        state.modules[name] = module.getState();
      }
    });

    return state;
  }

  /**
   * 리사이즈 처리
   */
  handleResize() {
    if (this.baseController) {
      this.baseController.handleResize();
    }
  }

  /**
   * 모듈 상태 리셋
   */
  resetModules() {
    Object.values(this.modules).forEach(module => {
      if (typeof module.cleanup === "function") {
        module.cleanup();
      }
    });
  }

  /**
   * 설정 저장
   */
  saveSettings() {
    const controlsModule = this.getModule("controls");
    if (controlsModule && typeof controlsModule.saveSettings === "function") {
      controlsModule.saveSettings();
    }
  }

  /**
   * 설정 로드
   */
  loadSettings() {
    const controlsModule = this.getModule("controls");
    if (controlsModule && typeof controlsModule.loadSettings === "function") {
      controlsModule.loadSettings();
    }
  }

  /**
   * 진단 정보 가져오기
   */
  getDiagnostics() {
    return {
      timestamp: new Date().toISOString(),
      isInitialized: this.isInitialized,
      moduleCount: Object.keys(this.modules).length,
      registeredModules: this.baseController
        ? Array.from(this.baseController.modules.keys())
        : [],
      baseControllerState: this.baseController?.getState(),
      moduleStates: Object.fromEntries(
        Object.entries(this.modules).map(([name, module]) => [
          name,
          typeof module.getState === "function"
            ? module.getState()
            : "No state method",
        ])
      ),
    };
  }

  /**
   * 에러 복구 시도
   */
  async recoverFromError() {
    try {
      console.log("뷰어 에러 복구 시도");

      // 모든 모듈 정리
      this.resetModules();

      // 베이스 컨트롤러 정리
      if (this.baseController) {
        this.baseController.cleanup();
      }

      // 재초기화
      this.isInitialized = false;
      await this.initialize();

      console.log("뷰어 에러 복구 완료");
      return true;
    } catch (error) {
      console.error("뷰어 에러 복구 실패:", error);
      return false;
    }
  }

  /**
   * 성능 모니터링
   */
  getPerformanceMetrics() {
    return {
      timestamp: Date.now(),
      memoryUsage: performance.memory
        ? {
            used: performance.memory.usedJSHeapSize,
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
          }
        : null,
      renderingFPS: this.calculateFPS(),
      moduleMetrics: this.getModuleMetrics(),
    };
  }

  /**
   * FPS 계산 (간단한 추정)
   */
  calculateFPS() {
    // 실제 구현에서는 requestAnimationFrame을 사용한 더 정확한 측정이 필요
    return 60; // 임시값
  }

  /**
   * 모듈 메트릭스 수집
   */
  getModuleMetrics() {
    const metrics = {};

    Object.entries(this.modules).forEach(([name, module]) => {
      metrics[name] = {
        initialized: !!module,
        hasState: typeof module.getState === "function",
        hasCleanup: typeof module.cleanup === "function",
      };
    });

    return metrics;
  }

  /**
   * 정리
   */
  cleanup() {
    try {
      console.log("ModularViewerController 정리 시작");

      // 설정 저장
      this.saveSettings();

      // 모든 모듈 정리
      Object.values(this.modules).forEach(module => {
        if (typeof module.cleanup === "function") {
          try {
            module.cleanup();
          } catch (error) {
            console.error("모듈 정리 중 오류:", error);
          }
        }
      });

      // 베이스 컨트롤러 정리
      if (this.baseController) {
        this.baseController.cleanup();
      }

      // 참조 해제
      this.modules = {};
      this.baseController = null;
      this.isInitialized = false;

      console.log("ModularViewerController 정리 완료");
    } catch (error) {
      console.error("ModularViewerController 정리 중 오류:", error);
    }
  }
}

export default ModularViewerController;
