/**
 * 뷰어 컨트롤러
 * 의료영상 뷰어, 측정 도구, 이미지 조작을 담당
 */

import { errorHandler } from "../core/errorHandler.js";
import { measurementEngine } from "../modules/measurementEngine.js";
import { imageProcessor } from "../modules/imageProcessor.js";
import { dicomApi } from "../services/apiService.js";
import { appState } from "../core/appStateManager.js";

export class ViewerController {
  constructor() {
    this.elements = {};
    this.canvases = {};
    this.viewerState = {
      mode: "select", // 'select', 'pan'
      isDragging: false,
      dragStart: null,
      currentMeasurement: null,
      measurementMode: null, // 'distance', 'angle', 'area'
    };
    this.imageData = null;
  }

  /**
   * 초기화
   */
  async initialize() {
    this.cacheElements();
    this.setupCanvases();
    this.setupEventListeners();
    this.setupControls();

    console.log("뷰어 컨트롤러 초기화 완료");
  }

  /**
   * DOM 요소 캐싱
   */
  cacheElements() {
    this.elements = {
      viewerView: document.getElementById("viewerView"),
      imageContainer: document.getElementById("imageContainer"),
      imageCanvas: document.getElementById("imageCanvas"),
      measurementCanvas: document.getElementById("measurementCanvas"),

      // 컨트롤들
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

      // 측정 도구
      measureDistance: document.getElementById("measureDistance"),
      measureAngle: document.getElementById("measureAngle"),
      measureArea: document.getElementById("measureArea"),
      clearMeasurements: document.getElementById("clearMeasurements"),
      measurementInfo: document.getElementById("measurementInfo"),
      selectedMeasurementInfo: document.getElementById("selectedMeasurementInfo"),
      measurementList: document.getElementById("measurementList"),

      // 정보 표시
      imageInfo: document.getElementById("imageInfo"),
      pixelInfo: document.getElementById("pixelInfo"),
      zoomIndicator: document.getElementById("zoomIndicator"),
    };
  }

  /**
   * 캔버스 설정
   */
  setupCanvases() {
    // 이미지 캔버스
    this.canvases.image = this.elements.imageCanvas;
    this.canvases.imageCtx = this.canvases.image.getContext("2d");

    // 측정 오버레이 캔버스
    this.canvases.measurement = this.elements.measurementCanvas;
    this.canvases.measurementCtx = this.canvases.measurement.getContext("2d");

    // 이미지 프로세서 초기화
    imageProcessor.initializeCanvas(this.canvases.image);
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 캔버스 이벤트
    this.elements.imageContainer?.addEventListener("mousedown", (e) =>
      this.handleMouseDown(e)
    );
    this.elements.imageContainer?.addEventListener("mousemove", (e) =>
      this.handleMouseMove(e)
    );
    this.elements.imageContainer?.addEventListener("mouseup", (e) =>
      this.handleMouseUp(e)
    );
    this.elements.imageContainer?.addEventListener("click", (e) =>
      this.handleClick(e)
    );
    this.elements.imageContainer?.addEventListener("wheel", (e) =>
      this.handleWheel(e)
    );
    this.elements.imageContainer?.addEventListener("contextmenu", (e) =>
      this.handleContextMenu(e)
    );

    // 윈도우 리사이즈
    window.addEventListener("resize", () => this.handleResize());
  }

  /**
   * 컨트롤 설정
   */
  setupControls() {
    // 모드 컨트롤
    this.elements.modeSelect?.addEventListener("click", () =>
      this.setViewerMode("select")
    );
    this.elements.modePan?.addEventListener("click", () =>
      this.setViewerMode("pan")
    );

    // 줌 컨트롤
    this.elements.zoomIn?.addEventListener("click", () => this.zoomIn());
    this.elements.zoomOut?.addEventListener("click", () => this.zoomOut());
    this.elements.zoomFit?.addEventListener("click", () => this.fitToWindow());
    this.elements.zoom100?.addEventListener("click", () => this.setZoom(1));

    // 이미지 조정
    this.elements.brightnessSlider?.addEventListener("input", (e) =>
      this.setBrightness(e.target.value)
    );
    this.elements.contrastSlider?.addEventListener("input", (e) =>
      this.setContrast(e.target.value)
    );
    this.elements.autoContrast?.addEventListener("click", () =>
      this.autoContrast()
    );
    this.elements.resetImage?.addEventListener("click", () =>
      this.resetImage()
    );

    // 측정 도구
    this.elements.measureDistance?.addEventListener("click", () =>
      this.setMeasurementMode("distance")
    );
    this.elements.measureAngle?.addEventListener("click", () =>
      this.setMeasurementMode("angle")
    );
    this.elements.measureArea?.addEventListener("click", () =>
      this.setMeasurementMode("area")
    );
    this.elements.clearMeasurements?.addEventListener("click", () =>
      this.clearMeasurements()
    );
  }

  /**
   * 뷰 활성화
   */
  async activate() {
    // 이미지 데이터가 있으면 표시
    const imageUrl = appState.getState("previewImageUrl");
    if (imageUrl) {
      await this.loadImage(imageUrl);
    }

    this.updateMeasurementList();
    this.updateCanvasSize();
  }

  /**
   * 뷰 비활성화
   */
  async deactivate() {
    // 측정 모드 해제
    this.setMeasurementMode(null);
  }

  /**
   * 데이터 로드
   * @param {Object} data - DICOM 데이터
   */
  async loadData(data) {
    try {
      // 이미지 정보 표시
      this.displayImageInfo(data);

      // 픽셀 간격 설정
      if (data.image_info?.pixel_spacing) {
        measurementEngine.setPixelSpacing(data.image_info.pixel_spacing);
      }

      // 미리보기 이미지 로드
      const imageUrl = appState.getState("previewImageUrl");
      if (imageUrl) {
        await this.loadImage(imageUrl);
      }
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "뷰어 데이터 로드",
      });
    }
  }

  /**
   * 이미지 로드
   * @param {string} imageUrl - 이미지 URL
   */
  async loadImage(imageUrl) {
    try {
      await imageProcessor.loadImage(imageUrl);
      this.imageData = imageProcessor.imageData;

      // 캔버스 크기 조정
      this.updateCanvasSize();

      // 화면에 맞춤
      this.fitToWindow();
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "이미지 로드",
      });
    }
  }

  /**
   * 캔버스 크기 업데이트
   */
  updateCanvasSize() {
    if (!this.imageData) return;

    const container = this.elements.imageContainer;
    const rect = container.getBoundingClientRect();

    // 두 캔버스 모두 컨테이너 크기에 맞춤
    const width = rect.width;
    const height = rect.height;

    // 이미지 캔버스 크기 설정
    this.canvases.image.width = width;
    this.canvases.image.height = height;
    this.canvases.image.style.width = width + 'px';
    this.canvases.image.style.height = height + 'px';

    // 측정 오버레이 캔버스 크기도 동일하게 설정
    this.canvases.measurement.width = width;
    this.canvases.measurement.height = height;
    this.canvases.measurement.style.width = width + 'px';
    this.canvases.measurement.style.height = height + 'px';
    
    // 측정 캔버스를 이미지 캔버스 위에 정확히 포지셔닝
    this.canvases.measurement.style.position = 'absolute';
    this.canvases.measurement.style.top = '0';
    this.canvases.measurement.style.left = '0';
    this.canvases.measurement.style.pointerEvents = 'none';

    this.redrawAll();
  }

  /**
   * 뷰어 모드 설정
   * @param {string} mode - 모드 ('select', 'pan')
   */
  setViewerMode(mode) {
    this.viewerState.mode = mode;

    // 버튼 스타일 업데이트
    if (this.elements.modeSelect && this.elements.modePan) {
      [this.elements.modeSelect, this.elements.modePan].forEach((btn) => {
        btn.classList.remove("bg-blue-500");
        btn.classList.add("bg-gray-500");
      });

      if (mode === "select") {
        this.elements.modeSelect.classList.remove("bg-gray-500");
        this.elements.modeSelect.classList.add("bg-blue-500");
      } else if (mode === "pan") {
        this.elements.modePan.classList.remove("bg-gray-500");
        this.elements.modePan.classList.add("bg-blue-500");
      }
    }

    this.updateCursor();
  }

  /**
   * 측정 모드 설정
   * @param {string} mode - 측정 모드 ('distance', 'angle', 'area', null)
   */
  setMeasurementMode(mode) {
    this.viewerState.measurementMode = mode;
    this.viewerState.currentMeasurement = null;

    // 선택 모드로 자동 전환
    if (mode) {
      this.setViewerMode("select");
    }

    // 버튼 스타일 업데이트
    const buttons = [
      { element: this.elements.measureDistance, mode: "distance" },
      { element: this.elements.measureAngle, mode: "angle" },
      { element: this.elements.measureArea, mode: "area" },
    ];

    buttons.forEach(({ element, mode: btnMode }) => {
      if (element) {
        if (btnMode === mode) {
          element.classList.remove("bg-green-500");
          element.classList.add("bg-green-700");
        } else {
          element.classList.remove("bg-green-700");
          element.classList.add("bg-green-500");
        }
      }
    });

    this.updateMeasurementInfo();
    this.updateCursor();
  }

  /**
   * 마우스 다운 처리
   */
  handleMouseDown(e) {
    if (!this.imageData) return;

    this.viewerState.isDragging = true;
    this.viewerState.dragStart = { x: e.clientX, y: e.clientY };

    if (this.viewerState.mode === "pan") {
      // 패닝 시작
      this.elements.imageContainer.style.cursor = "grabbing";
    }
  }

  /**
   * 마우스 이동 처리
   */
  handleMouseMove(e) {
    if (!this.imageData) return;

    // 픽셀 정보 업데이트
    this.updatePixelInfo(e);

    if (this.viewerState.isDragging && this.viewerState.mode === "pan") {
      // 패닝 처리
      if (this.viewerState.dragStart) {
        const dx = e.clientX - this.viewerState.dragStart.x;
        const dy = e.clientY - this.viewerState.dragStart.y;

        // 현재 변환 상태 가져오기
        const currentTransform = imageProcessor.transform || { translateX: 0, translateY: 0, scale: 1 };
        
        // 새로운 변환 적용
        imageProcessor.applyTransform({
          translateX: currentTransform.translateX + dx / currentTransform.scale,
          translateY: currentTransform.translateY + dy / currentTransform.scale
        });

        // 드래그 시작점 업데이트
        this.viewerState.dragStart = { x: e.clientX, y: e.clientY };
        
        this.redrawMeasurements();
      }
    }
  }

  /**
   * 마우스 업 처리
   */
  handleMouseUp(e) {
    this.viewerState.isDragging = false;
    this.updateCursor();
  }

  /**
   * 클릭 처리
   */
  handleClick(e) {
    if (!this.imageData || this.viewerState.isDragging) return;

    if (this.viewerState.measurementMode) {
      this.handleMeasurementClick(e);
    }
  }

  /**
   * 측정 클릭 처리
   */
  handleMeasurementClick(e) {
    const point = this.getImagePoint(e);

    if (!this.viewerState.currentMeasurement) {
      // 새 측정 시작
      this.viewerState.currentMeasurement = {
        type: this.viewerState.measurementMode,
        points: [point],
      };
    } else {
      // 점 추가
      this.viewerState.currentMeasurement.points.push(point);

      // 측정 완료 확인
      const requiredPoints = {
        distance: 2,
        angle: 3,
        area: Infinity, // 우클릭으로 완료
      };

      if (
        this.viewerState.currentMeasurement.points.length >=
        requiredPoints[this.viewerState.measurementMode]
      ) {
        if (this.viewerState.measurementMode !== "area") {
          this.completeMeasurement();
        }
      }
    }

    this.redrawMeasurements();
  }

  /**
   * 우클릭 처리 (면적 측정 완료)
   */
  handleContextMenu(e) {
    e.preventDefault();

    if (
      this.viewerState.measurementMode === "area" &&
      this.viewerState.currentMeasurement &&
      this.viewerState.currentMeasurement.points.length >= 3
    ) {
      this.completeMeasurement();
    }
  }

  /**
   * 휠 처리 (줌)
   */
  handleWheel(e) {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.zoom(delta);
  }

  /**
   * 측정 완료
   */
  completeMeasurement() {
    if (!this.viewerState.currentMeasurement) return;

    const { type, points } = this.viewerState.currentMeasurement;

    try {
      let measurement;
      switch (type) {
        case "distance":
          measurement = measurementEngine.createDistanceMeasurement(points);
          break;
        case "angle":
          measurement = measurementEngine.createAngleMeasurement(points);
          break;
        case "area":
          measurement = measurementEngine.createAreaMeasurement(points);
          break;
      }

      this.updateMeasurementList();
    } catch (error) {
      errorHandler.handleError(error, {
        context: "측정 완료 처리",
      });
    }

    this.viewerState.currentMeasurement = null;
    this.redrawMeasurements();
  }

  /**
   * 좌표 변환 (캔버스 좌표 -> 이미지 좌표)
   */
  getImagePoint(e) {
    const rect = this.elements.imageContainer.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // 안전한 좌표 변환
    if (!this.imageData) {
      return { x: 0, y: 0, imageX: 0, imageY: 0 };
    }

    // 현재 변환 상태 가져오기
    const transform = imageProcessor.transform || { scale: 1, translateX: 0, translateY: 0 };
    
    // 캔버스 중심점
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // 역변환 계산
    const imageX = ((canvasX - centerX) / transform.scale) - transform.translateX + (this.imageData.width / 2);
    const imageY = ((canvasY - centerY) / transform.scale) - transform.translateY + (this.imageData.height / 2);

    return {
      x: Math.round(Math.max(0, Math.min(this.imageData.width - 1, imageX))),
      y: Math.round(Math.max(0, Math.min(this.imageData.height - 1, imageY))),
      imageX: Math.round(imageX),
      imageY: Math.round(imageY),
      relativeX: imageX / this.imageData.width,
      relativeY: imageY / this.imageData.height
    };
  }

  /**
   * 줌 조작
   */
  zoomIn() {
    this.zoom(1.2);
  }
  
  zoomOut() {
    this.zoom(0.8);
  }

  zoom(factor) {
    if (!this.imageData) return;
    
    const currentTransform = imageProcessor.transform || { scale: 1 };
    const currentScale = currentTransform.scale || 1;
    const newScale = Math.max(0.1, Math.min(5, currentScale * factor));

    imageProcessor.applyTransform({ scale: newScale });
    this.updateZoomDisplay(newScale);
    this.redrawMeasurements();
  }

  setZoom(scale) {
    if (!this.imageData) return;
    
    const clampedScale = Math.max(0.1, Math.min(5, scale));
    imageProcessor.applyTransform({ scale: clampedScale });
    this.updateZoomDisplay(clampedScale);
    this.redrawMeasurements();
  }

  fitToWindow() {
    if (!this.imageData) return;

    const container = this.elements.imageContainer;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    
    if (containerRect.width === 0 || containerRect.height === 0) return;

    const scaleX = containerRect.width / this.imageData.width;
    const scaleY = containerRect.height / this.imageData.height;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 여유 공간

    imageProcessor.applyTransform({
      scale: scale,
      translateX: 0,
      translateY: 0,
    });

    this.updateZoomDisplay(scale);
    this.redrawMeasurements();
  }

  /**
   * 이미지 조정
   */
  setBrightness(value) {
    const brightnessValue = parseInt(value) || 0;
    imageProcessor.applyAdjustments({ brightness: brightnessValue });
    if (this.elements.brightnessValue) {
      this.elements.brightnessValue.textContent = brightnessValue.toString();
    }
  }

  setContrast(value) {
    const contrastValue = parseInt(value) || 100;
    const contrast = contrastValue / 100;
    imageProcessor.applyAdjustments({ contrast });
    if (this.elements.contrastValue) {
      this.elements.contrastValue.textContent = contrastValue + "%";
    }
  }

  autoContrast() {
    try {
      imageProcessor.autoContrast();
    } catch (error) {
      console.warn("자동 대비 조정 실패:", error);
    }
  }

  resetImage() {
    try {
      imageProcessor.reset();
      this.updateZoomDisplay(1);

      // 슬라이더 초기화
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
    } catch (error) {
      console.warn("이미지 리셋 실패:", error);
    }
  }

  /**
   * 측정 관련
   */
  clearMeasurements() {
    measurementEngine.clearAllMeasurements();
    this.viewerState.currentMeasurement = null;
    this.updateMeasurementList();
    this.redrawMeasurements();
  }

  cancelMeasurement() {
    this.viewerState.currentMeasurement = null;
    this.setMeasurementMode(null);
    this.redrawMeasurements();
  }

  /**
   * UI 업데이트
   */
  updateZoomDisplay(scale) {
    // 안전한 scale 값 확인
    const safeScale = isNaN(scale) ? 1 : Math.max(0.1, Math.min(5, scale));
    const percentage = Math.round(safeScale * 100);
    
    if (this.elements.zoomValue) {
      this.elements.zoomValue.textContent = percentage + "%";
    }
    if (this.elements.zoomIndicator) {
      this.elements.zoomIndicator.textContent = percentage + "%";
    }
  }

  updateCursor() {
    const container = this.elements.imageContainer;
    if (!container) return;

    if (this.viewerState.mode === "pan") {
      container.style.cursor = this.viewerState.isDragging
        ? "grabbing"
        : "grab";
    } else if (this.viewerState.measurementMode) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "default";
    }
  }

  updatePixelInfo(e) {
    if (!this.imageData || !this.elements.pixelInfo) return;
    
    try {
      const point = this.getImagePoint(e);
      
      // 좌표가 유효한지 확인
      if (isNaN(point.x) || isNaN(point.y)) {
        this.elements.pixelInfo.classList.add("hidden");
        return;
      }
      
      const pixelValue = imageProcessor.getPixelValue(point.x, point.y);
      
      if (pixelValue) {
        this.elements.pixelInfo.textContent = `X: ${point.x}, Y: ${point.y}, Value: ${pixelValue.gray || 0}`;
        this.elements.pixelInfo.style.left = (e.clientX + 10) + "px";
        this.elements.pixelInfo.style.top = (e.clientY - 30) + "px";
        this.elements.pixelInfo.classList.remove("hidden");
      } else {
        this.elements.pixelInfo.classList.add("hidden");
      }
    } catch (error) {
      console.warn("픽셀 정보 업데이트 실패:", error);
      this.elements.pixelInfo.classList.add("hidden");
    }
  }

  updateMeasurementInfo() {
    if (!this.elements.measurementInfo) return;

    const messages = {
      distance: "거리 측정: 두 점을 클릭하세요",
      angle: "각도 측정: 세 점을 순서대로 클릭하세요",
      area: "면적 측정: 경계를 클릭하세요 (우클릭으로 완료)",
      null: "측정 도구를 선택하세요",
    };

    this.elements.measurementInfo.textContent =
      messages[this.viewerState.measurementMode];
  }

  updateMeasurementList() {
    if (!this.elements.measurementList) return;

    const measurements = measurementEngine.getAllMeasurements();
    this.elements.measurementList.innerHTML = "";

    measurements.forEach((measurement) => {
      const item = document.createElement("div");
      item.className =
        "text-xs p-1 bg-gray-100 rounded cursor-pointer hover:bg-gray-200";
      item.textContent = `${measurement.type}: ${measurement.label}`;
      item.addEventListener("click", () => {
        // 측정 선택/삭제 기능
        if (confirm("이 측정을 삭제하시겠습니까?")) {
          measurementEngine.deleteMeasurement(measurement.id);
          this.updateMeasurementList();
          this.redrawMeasurements();
        }
      });
      this.elements.measurementList.appendChild(item);
    });
  }

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
   * 화면 다시 그리기
   */
  redrawAll() {
    // 이미지 프로세서로 이미지 렌더링
    imageProcessor.render();
    
    // 측정 오버레이 다시 그리기
    this.redrawMeasurements();
  }

  redrawMeasurements() {
    const ctx = this.canvases.measurementCtx;
    if (!ctx) return;
    
    // 측정 캔버스 클리어
    ctx.clearRect(0, 0, this.canvases.measurement.width, this.canvases.measurement.height);

    // 현재 이미지 변환 상태 가져오기
    const transform = imageProcessor.transform || { scale: 1, translateX: 0, translateY: 0, rotation: 0 };
    
    // 측정 캔버스에도 같은 변환 적용
    ctx.save();
    
    // 이미지와 동일한 변환 매트릭스 적용
    const centerX = this.canvases.measurement.width / 2;
    const centerY = this.canvases.measurement.height / 2;
    
    ctx.translate(centerX, centerY);
    ctx.scale(transform.scale, transform.scale);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.translate(transform.translateX, transform.translateY);

    // 완료된 측정들 그리기
    const measurements = measurementEngine.getAllMeasurements();
    measurements.forEach((measurement) => {
      this.drawMeasurement(ctx, measurement, transform);
    });

    // 현재 그리는 중인 측정 그리기
    if (this.viewerState.currentMeasurement) {
      this.drawCurrentMeasurement(ctx, this.viewerState.currentMeasurement, transform);
    }
    
    ctx.restore();
  }

  drawMeasurement(ctx, measurement, transform) {
    // 기본 스타일
    ctx.strokeStyle = "#ff6b6b";
    ctx.fillStyle = "#ff6b6b";
    ctx.lineWidth = 2 / (transform?.scale || 1); // 스케일에 따라 선 굵기 조정

    // 이미지 좌표를 측정 캔버스의 로컬 좌표로 변환
    const points = measurement.points.map((p) => ({
      x: p.imageX - (this.imageData.width / 2),
      y: p.imageY - (this.imageData.height / 2)
    }));

    if (measurement.type === "distance") {
      this.drawLine(ctx, points[0], points[1]);
      this.drawPoints(ctx, points, transform);
      this.drawLabel(
        ctx,
        measurement.label,
        (points[0].x + points[1].x) / 2,
        (points[0].y + points[1].y) / 2,
        transform
      );
    } else if (measurement.type === "angle") {
      this.drawLine(ctx, points[1], points[0]);
      this.drawLine(ctx, points[1], points[2]);
      this.drawPoints(ctx, points, transform);
      this.drawLabel(
        ctx,
        measurement.label,
        points[1].x + 20 / (transform?.scale || 1),
        points[1].y - 20 / (transform?.scale || 1),
        transform
      );
    } else if (measurement.type === "area") {
      this.drawPolygon(ctx, points);
      this.drawPoints(ctx, points, transform);
      const center = this.getPolygonCenter(points);
      this.drawLabel(ctx, measurement.label, center.x, center.y, transform);
    }
  }

  drawCurrentMeasurement(ctx, measurement, transform) {
    ctx.strokeStyle = "#4dabf7";
    ctx.fillStyle = "#4dabf7";
    ctx.lineWidth = 2 / (transform?.scale || 1);

    const points = measurement.points.map((p) => ({
      x: p.imageX - (this.imageData.width / 2),
      y: p.imageY - (this.imageData.height / 2)
    }));

    this.drawPoints(ctx, points, transform);

    if (points.length > 1) {
      for (let i = 0; i < points.length - 1; i++) {
        this.drawLine(ctx, points[i], points[i + 1]);
      }
    }
  }

  drawLine(ctx, p1, p2) {
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  drawPoints(ctx, points, transform) {
    const radius = 4 / (transform?.scale || 1); // 스케일에 따라 점 크기 조정
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  drawPolygon(ctx, points) {
    if (points.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 107, 107, 0.2)";
    ctx.fill();
  }

  drawLabel(ctx, text, x, y, transform) {
    const fontSize = 12 / (transform?.scale || 1); // 스케일에 따라 폰트 크기 조정
    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3 / (transform?.scale || 1);

    // 배경
    const metrics = ctx.measureText(text);
    const padding = 4 / (transform?.scale || 1);
    ctx.fillRect(
      x - metrics.width / 2 - padding,
      y - fontSize - padding,
      metrics.width + 2 * padding,
      fontSize + 2 * padding
    );
    ctx.strokeRect(
      x - metrics.width / 2 - padding,
      y - fontSize - padding,
      metrics.width + 2 * padding,
      fontSize + 2 * padding
    );

    // 텍스트
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.fillText(text, x, y);
  }

  getPolygonCenter(points) {
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { x, y };
  }

  /**
   * 스크린샷 저장
   */
  async saveScreenshot() {
    try {
      const dataUrl = imageProcessor.captureScreenshot(
        this.elements.imageContainer
      );
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
   * 리사이즈 처리
   */
  handleResize() {
    this.updateCanvasSize();
  }

  /**
   * 정리
   */
  cleanup() {
    this.viewerState.currentMeasurement = null;
    this.setMeasurementMode(null);
    imageProcessor.cleanup();
  }
}

export default ViewerController;