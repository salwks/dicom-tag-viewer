/**
 * controllers/viewer/ControlsModule.js
 * 뷰어 컨트롤 UI 담당 모듈
 */

import { appState } from "../../core/appStateManager.js";
import { errorHandler } from "../../core/errorHandler.js";

export class ControlsModule {
  constructor() {
    this.baseController = null;
    this.imageDisplayModule = null;
    this.interactionModule = null;

    // 컨트롤 상태
    this.state = {
      isEnabled: true,
      values: {
        brightness: 0,
        contrast: 100,
        zoom: 100,
      },
    };

    // UI 요소들
    this.elements = {};
  }

  /**
   * 베이스 컨트롤러 설정
   */
  setBaseController(baseController) {
    this.baseController = baseController;
    this.cacheElements();
    this.setupEventListeners();
  }

  /**
   * 다른 모듈들 설정
   */
  setImageDisplayModule(imageDisplayModule) {
    this.imageDisplayModule = imageDisplayModule;
  }

  setInteractionModule(interactionModule) {
    this.interactionModule = interactionModule;
  }

  /**
   * DOM 요소 캐싱
   */
  cacheElements() {
    this.elements = {
      // 모드 컨트롤
      modeSelect: document.getElementById("modeSelect"),
      modePan: document.getElementById("modePan"),

      // 줌 컨트롤
      zoomIn: document.getElementById("zoomIn"),
      zoomOut: document.getElementById("zoomOut"),
      zoomFit: document.getElementById("zoomFit"),
      zoom100: document.getElementById("zoom100"),
      zoomValue: document.getElementById("zoomValue"),

      // 이미지 조정
      brightnessSlider: document.getElementById("brightnessSlider"),
      brightnessValue: document.getElementById("brightnessValue"),
      contrastSlider: document.getElementById("contrastSlider"),
      contrastValue: document.getElementById("contrastValue"),
      autoContrast: document.getElementById("autoContrast"),
      resetImage: document.getElementById("resetImage"),

      // 정보 표시
      imageInfo: document.getElementById("imageInfo"),
    };
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 모드 컨트롤
    this.elements.modeSelect?.addEventListener("click", () => {
      this.setInteractionMode("select");
    });

    this.elements.modePan?.addEventListener("click", () => {
      this.setInteractionMode("pan");
    });

    // 줌 컨트롤
    this.elements.zoomIn?.addEventListener("click", () => {
      this.zoomIn();
    });

    this.elements.zoomOut?.addEventListener("click", () => {
      this.zoomOut();
    });

    this.elements.zoomFit?.addEventListener("click", () => {
      this.fitToWindow();
    });

    this.elements.zoom100?.addEventListener("click", () => {
      this.setZoom(1);
    });

    // 이미지 조정 슬라이더
    this.elements.brightnessSlider?.addEventListener("input", e => {
      this.setBrightness(parseInt(e.target.value));
    });

    this.elements.contrastSlider?.addEventListener("input", e => {
      this.setContrast(parseInt(e.target.value));
    });

    // 자동 조정 버튼
    this.elements.autoContrast?.addEventListener("click", () => {
      this.autoContrast();
    });

    this.elements.resetImage?.addEventListener("click", () => {
      this.resetImage();
    });

    // 상태 구독
    this.setupStateSubscriptions();
  }

  /**
   * 상태 구독 설정
   */
  setupStateSubscriptions() {
    // 한 번만 구독하도록 플래그 사용
    if (this._stateSubscribed) return;

    // 줌 상태 변경 구독
    appState.subscribe("viewer.displayInfo", info => {
      if (info?.scale && this.state.isEnabled) {
        this.updateZoomDisplay(info.scale);
      }
    });

    // 상호작용 모드 변경 구독
    appState.subscribe("viewer.interactionMode", mode => {
      if (this.state.isEnabled) {
        this.updateModeButtons(mode);
      }
    });

    this._stateSubscribed = true;
  }

  /**
   * 상호작용 모드 설정
   */
  setInteractionMode(mode) {
    if (this.interactionModule) {
      this.interactionModule.setMode(mode);
    }
  }

  /**
   * 모드 버튼 상태 업데이트
   */
  updateModeButtons(activeMode) {
    const buttons = [
      { element: this.elements.modeSelect, mode: "select" },
      { element: this.elements.modePan, mode: "pan" },
    ];

    buttons.forEach(({ element, mode }) => {
      if (!element) return;

      if (mode === activeMode) {
        element.classList.remove("bg-gray-500");
        element.classList.add("bg-blue-500");
      } else {
        element.classList.remove("bg-blue-500");
        element.classList.add("bg-gray-500");
      }
    });
  }

  /**
   * 줌 관련 메서드들
   */
  zoomIn() {
    if (this.interactionModule) {
      this.interactionModule.zoom(1.2);
    }
  }

  zoomOut() {
    if (this.interactionModule) {
      this.interactionModule.zoom(0.8);
    }
  }

  setZoom(scale) {
    if (this.imageDisplayModule) {
      this.imageDisplayModule.applyTransform({ scale });
    }
  }

  fitToWindow() {
    if (this.interactionModule) {
      this.interactionModule.fitToWindow();
    }
  }

  /**
   * 줌 표시 업데이트
   */
  updateZoomDisplay(scale) {
    const percentage = Math.round(scale * 100);
    this.state.values.zoom = percentage;

    if (this.elements.zoomValue) {
      this.elements.zoomValue.textContent = `${percentage}%`;
    }
  }

  /**
   * 이미지 조정 메서드들
   */
  setBrightness(value) {
    this.state.values.brightness = value;

    if (this.elements.brightnessValue) {
      this.elements.brightnessValue.textContent = value.toString();
    }

    if (this.imageDisplayModule) {
      this.imageDisplayModule.applyAdjustments({ brightness: value });
    }
  }

  setContrast(value) {
    this.state.values.contrast = value;

    if (this.elements.contrastValue) {
      this.elements.contrastValue.textContent = `${value}%`;
    }

    if (this.imageDisplayModule) {
      this.imageDisplayModule.applyAdjustments({ contrast: value });
    }
  }

  /**
   * 자동 대비 조정
   */
  autoContrast() {
    // 간단한 자동 대비 알고리즘
    // 실제로는 히스토그램 분석이 필요하지만 여기서는 기본값 적용
    this.setBrightness(0);
    this.setContrast(120);

    // UI 슬라이더 업데이트
    if (this.elements.brightnessSlider) {
      this.elements.brightnessSlider.value = "0";
    }
    if (this.elements.contrastSlider) {
      this.elements.contrastSlider.value = "120";
    }
  }

  /**
   * 이미지 설정 초기화
   */
  resetImage() {
    // 값 초기화
    this.state.values = {
      brightness: 0,
      contrast: 100,
      zoom: 100,
    };

    // UI 업데이트
    if (this.elements.brightnessSlider) {
      this.elements.brightnessSlider.value = "0";
    }
    if (this.elements.brightnessValue) {
      this.elements.brightnessValue.textContent = "0";
    }
    if (this.elements.contrastSlider) {
      this.elements.contrastSlider.value = "100";
    }
    if (this.elements.contrastValue) {
      this.elements.contrastValue.textContent = "100%";
    }

    // 이미지 모듈에 초기화 적용
    if (this.imageDisplayModule) {
      this.imageDisplayModule.resetTransform();
      this.imageDisplayModule.resetAdjustments();
    }
  }

  /**
   * 이미지 정보 표시
   */
  displayImageInfo(data) {
    if (!this.elements.imageInfo || !data.image_info) return;

    const info = data.image_info;
    this.elements.imageInfo.innerHTML = `
      <div>크기: ${info.columns || "N/A"} × ${info.rows || "N/A"}</div>
      <div>비트: ${info.bits_allocated || "N/A"} bit</div>
      <div>픽셀간격: ${info.pixel_spacing || "N/A"}</div>
    `;
  }

  /**
   * 컨트롤 활성화/비활성화
   */
  setEnabled(enabled) {
    this.state.isEnabled = enabled;

    const allElements = Object.values(this.elements).filter(el => el);

    allElements.forEach(element => {
      if (element.tagName === "BUTTON") {
        element.disabled = !enabled;
        if (enabled) {
          element.classList.remove("opacity-50", "cursor-not-allowed");
        } else {
          element.classList.add("opacity-50", "cursor-not-allowed");
        }
      } else if (element.tagName === "INPUT") {
        element.disabled = !enabled;
      }
    });
  }

  /**
   * 단축키 정보 표시
   */
  showShortcutHelp() {
    const helpModal = document.getElementById("helpModal");
    if (helpModal) {
      helpModal.classList.remove("hidden");

      // 닫기 이벤트
      const closeBtn = document.getElementById("closeHelp");
      const closeHandler = () => {
        helpModal.classList.add("hidden");
        closeBtn?.removeEventListener("click", closeHandler);
      };
      closeBtn?.addEventListener("click", closeHandler);
    }
  }

  /**
   * 설정 저장
   */
  saveSettings() {
    const settings = {
      brightness: this.state.values.brightness,
      contrast: this.state.values.contrast,
      interactionMode: this.interactionModule?.getState().mode || "select",
    };

    localStorage.setItem("dicom-viewer-settings", JSON.stringify(settings));
    console.log("설정 저장됨:", settings);
  }

  /**
   * 설정 로드
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem("dicom-viewer-settings");
      if (!saved) return;

      const settings = JSON.parse(saved);

      // 밝기 설정 복원
      if (typeof settings.brightness === "number") {
        this.setBrightness(settings.brightness);
        if (this.elements.brightnessSlider) {
          this.elements.brightnessSlider.value = settings.brightness.toString();
        }
      }

      // 대비 설정 복원
      if (typeof settings.contrast === "number") {
        this.setContrast(settings.contrast);
        if (this.elements.contrastSlider) {
          this.elements.contrastSlider.value = settings.contrast.toString();
        }
      }

      // 상호작용 모드 복원
      if (settings.interactionMode) {
        this.setInteractionMode(settings.interactionMode);
      }

      console.log("설정 로드됨:", settings);
    } catch (error) {
      console.warn("설정 로드 실패:", error);
    }
  }

  /**
   * 프리셋 적용
   */
  applyPreset(presetName) {
    const presets = {
      default: { brightness: 0, contrast: 100 },
      bright: { brightness: 20, contrast: 110 },
      dark: { brightness: -20, contrast: 90 },
      highContrast: { brightness: 0, contrast: 150 },
    };

    const preset = presets[presetName];
    if (!preset) return;

    this.setBrightness(preset.brightness);
    this.setContrast(preset.contrast);

    // UI 업데이트
    if (this.elements.brightnessSlider) {
      this.elements.brightnessSlider.value = preset.brightness.toString();
    }
    if (this.elements.contrastSlider) {
      this.elements.contrastSlider.value = preset.contrast.toString();
    }
  }

  /**
   * 모듈 이벤트 핸들러
   */
  onActivate() {
    this.setEnabled(true);
    this.loadSettings();
  }

  onDeactivate() {
    this.saveSettings();
    this.setEnabled(false);
  }

  onImageLoaded(imageData) {
    // 이미지 로드 시 컨트롤 활성화 및 정보 표시
    this.setEnabled(true);

    // 이미지 정보가 있다면 표시
    const dicomData = appState.getState("dicomData");
    if (dicomData) {
      this.displayImageInfo(dicomData);
    }
  }

  /**
   * 현재 상태 가져오기
   */
  getState() {
    return {
      isEnabled: this.state.isEnabled,
      values: { ...this.state.values },
    };
  }

  /**
   * 정리
   */
  cleanup() {
    this.setEnabled(false);
    this.state = {
      isEnabled: true,
      values: {
        brightness: 0,
        contrast: 100,
        zoom: 100,
      },
    };

    console.log("ControlsModule 정리 완료");
  }
}

export default ControlsModule;
