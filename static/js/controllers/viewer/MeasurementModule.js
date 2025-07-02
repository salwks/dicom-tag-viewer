/**
 * controllers/viewer/MeasurementModule.js
 * 측정 기능 담당 모듈
 */

import { appState } from "../../core/appStateManager.js";
import { errorHandler } from "../../core/errorHandler.js";
import { measurementEngine } from "../../modules/measurementEngine.js";

export class MeasurementModule {
  constructor() {
    this.baseController = null;
    this.imageDisplayModule = null;

    // 측정 상태
    this.state = {
      mode: null, // 'distance', 'angle', 'area', null
      currentMeasurement: null,
      isEnabled: true,
      measurements: [],
    };

    // UI 요소들
    this.elements = {};

    // 무한 재귀 방지 플래그들
    this._isRendering = false;
    this._stateSubscribed = false;
    this._lastRenderTime = 0;
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
   * 이미지 표시 모듈 설정
   */
  setImageDisplayModule(imageDisplayModule) {
    this.imageDisplayModule = imageDisplayModule;
  }

  /**
   * DOM 요소 캐싱
   */
  cacheElements() {
    this.elements = {
      measureDistance: document.getElementById("measureDistance"),
      measureAngle: document.getElementById("measureAngle"),
      measureArea: document.getElementById("measureArea"),
      clearMeasurements: document.getElementById("clearMeasurements"),
      measurementInfo: document.getElementById("measurementInfo"),
      selectedMeasurementInfo: document.getElementById(
        "selectedMeasurementInfo"
      ),
      measurementList: document.getElementById("measurementList"),
    };
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 측정 도구 버튼들
    this.elements.measureDistance?.addEventListener("click", () => {
      this.setMeasurementMode("distance");
    });

    this.elements.measureAngle?.addEventListener("click", () => {
      this.setMeasurementMode("angle");
    });

    this.elements.measureArea?.addEventListener("click", () => {
      this.setMeasurementMode("area");
    });

    this.elements.clearMeasurements?.addEventListener("click", () => {
      this.clearAllMeasurements();
    });

    // 측정 엔진 상태 구독 (한 번만 설정)
    if (!this._stateSubscribed) {
      appState.subscribe("viewer.measurements", measurements => {
        this.state.measurements = measurements || [];
        this.updateMeasurementList();
        if (this.state.isEnabled) {
          this.renderMeasurements();
        }
      });
      this._stateSubscribed = true;
    }
  }

  /**
   * 측정 모드 설정
   */
  setMeasurementMode(mode) {
    // 이전 측정 취소
    this.cancelCurrentMeasurement();

    this.state.mode = mode;
    this.updateButtonStates();
    this.updateMeasurementInfo();

    // 상호작용 모드를 선택으로 변경
    const interactionModule = this.baseController?.getModule("interaction");
    if (interactionModule) {
      interactionModule.setMode("select");
    }

    appState.setState("viewer.measurementMode", mode);
    console.log("측정 모드 변경:", mode);
  }

  /**
   * 버튼 상태 업데이트
   */
  updateButtonStates() {
    const buttons = [
      { element: this.elements.measureDistance, mode: "distance" },
      { element: this.elements.measureAngle, mode: "angle" },
      { element: this.elements.measureArea, mode: "area" },
    ];

    buttons.forEach(({ element, mode }) => {
      if (!element) return;

      if (mode === this.state.mode) {
        element.classList.remove("bg-green-500");
        element.classList.add("bg-green-700", "tool-active");
      } else {
        element.classList.remove("bg-green-700", "tool-active");
        element.classList.add("bg-green-500");
      }
    });
  }

  /**
   * 측정 정보 업데이트
   */
  updateMeasurementInfo() {
    if (!this.elements.measurementInfo) return;

    const messages = {
      distance: "거리 측정: 두 점을 클릭하세요",
      angle: "각도 측정: 세 점을 순서대로 클릭하세요",
      area: "면적 측정: 경계를 클릭하세요 (우클릭으로 완료)",
      null: "측정 도구를 선택하세요",
    };

    this.elements.measurementInfo.textContent =
      messages[this.state.mode] || messages[null];
  }

  /**
   * 측정 목록 업데이트
   */
  updateMeasurementList() {
    if (!this.elements.measurementList) return;

    this.elements.measurementList.innerHTML = "";

    this.state.measurements.forEach((measurement, index) => {
      const item = document.createElement("div");
      item.className =
        "text-xs p-1 bg-gray-100 rounded cursor-pointer hover:bg-gray-200 flex justify-between items-center";

      const label = document.createElement("span");
      label.textContent = `${measurement.type}: ${measurement.label}`;

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "×";
      deleteBtn.className = "ml-2 text-red-500 hover:text-red-700 font-bold";
      deleteBtn.addEventListener("click", e => {
        e.stopPropagation();
        this.deleteMeasurement(measurement.id);
      });

      item.appendChild(label);
      item.appendChild(deleteBtn);

      // 측정 항목 클릭 시 하이라이트
      item.addEventListener("click", () => {
        this.highlightMeasurement(measurement.id);
      });

      this.elements.measurementList.appendChild(item);
    });
  }

  /**
   * 상호작용 이벤트 핸들러들
   */
  onInteraction_click(data) {
    if (!this.state.isEnabled || !this.state.mode || !data.imageCoords) return;

    this.addMeasurementPoint(data.imageCoords);
  }

  onInteraction_contextmenu(data) {
    if (!this.state.isEnabled || this.state.mode !== "area") return;
    if (!this.state.currentMeasurement) return;

    // 면적 측정 완료
    if (this.state.currentMeasurement.points.length >= 3) {
      this.completeMeasurement();
    }
  }

  onInteraction_keydown(data) {
    if (!this.state.isEnabled) return;

    switch (data.key) {
      case "1":
        this.setMeasurementMode("distance");
        break;
      case "2":
        this.setMeasurementMode("angle");
        break;
      case "3":
        this.setMeasurementMode("area");
        break;
      case "Escape":
        this.cancelCurrentMeasurement();
        break;
    }
  }

  onInteraction_cancel() {
    this.cancelCurrentMeasurement();
  }

  /**
   * 측정점 추가
   */
  addMeasurementPoint(imageCoords) {
    if (!this.state.currentMeasurement) {
      // 새 측정 시작
      this.state.currentMeasurement = {
        type: this.state.mode,
        points: [this.normalizePoint(imageCoords)],
      };
    } else {
      // 점 추가
      this.state.currentMeasurement.points.push(
        this.normalizePoint(imageCoords)
      );
    }

    // 측정 완료 확인
    const requiredPoints = {
      distance: 2,
      angle: 3,
      area: Infinity, // 우클릭으로 완료
    };

    if (
      this.state.currentMeasurement.points.length >=
      requiredPoints[this.state.mode]
    ) {
      if (this.state.mode !== "area") {
        this.completeMeasurement();
      }
    }

    this.renderMeasurements();
  }

  /**
   * 점 정규화
   */
  normalizePoint(imageCoords) {
    return {
      x: imageCoords.x,
      y: imageCoords.y,
      imageX: imageCoords.imageX || imageCoords.x,
      imageY: imageCoords.imageY || imageCoords.y,
      timestamp: Date.now(),
    };
  }

  /**
   * 측정 완료
   */
  completeMeasurement() {
    if (!this.state.currentMeasurement) return;

    try {
      const { type, points } = this.state.currentMeasurement;
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

      console.log("측정 완료:", measurement);
    } catch (error) {
      errorHandler.handleError(error, {
        context: "측정 완료 처리",
      });
    }

    this.state.currentMeasurement = null;
    this.renderMeasurements();
  }

  /**
   * 현재 측정 취소
   */
  cancelCurrentMeasurement() {
    this.state.currentMeasurement = null;
    this.setMeasurementMode(null);
    this.renderMeasurements();
  }

  /**
   * 측정 삭제
   */
  deleteMeasurement(id) {
    if (confirm("이 측정을 삭제하시겠습니까?")) {
      measurementEngine.deleteMeasurement(id);
    }
  }

  /**
   * 모든 측정 클리어
   */
  clearAllMeasurements() {
    if (confirm("모든 측정을 삭제하시겠습니까?")) {
      measurementEngine.clearAllMeasurements();
      this.state.currentMeasurement = null;
    }
  }

  /**
   * 측정 하이라이트
   */
  highlightMeasurement(id) {
    // TODO: 특정 측정을 하이라이트 표시
    console.log("측정 하이라이트:", id);
  }

  /**
   * 측정 렌더링
   */
  renderMeasurements() {
    // 이미 렌더링 중이거나 너무 빠른 호출 방지
    const now = Date.now();
    if (this._isRendering || now - this._lastRenderTime < 50) {
      return;
    }

    if (
      !this.baseController?.canvases.measurementCtx ||
      !this.imageDisplayModule ||
      !this.state.isEnabled
    ) {
      return;
    }

    // 이미지가 로드되지 않았으면 렌더링하지 않음
    if (!this.imageDisplayModule.imageData) {
      return;
    }

    this._isRendering = true;
    this._lastRenderTime = now;

    try {
      const ctx = this.baseController.canvases.measurementCtx;

      // 캔버스 클리어
      this.baseController.clearCanvas("measurement");

      // 이미지 변환 상태 가져오기
      const transform = this.imageDisplayModule.transform;

      // 변환 매트릭스 적용
      ctx.save();
      ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
      ctx.scale(transform.scale, transform.scale);
      ctx.translate(transform.translateX, transform.translateY);

      // 완료된 측정들 그리기
      this.state.measurements.forEach(measurement => {
        this.drawMeasurement(ctx, measurement, transform);
      });

      // 현재 그리는 중인 측정 그리기
      if (this.state.currentMeasurement) {
        this.drawCurrentMeasurement(
          ctx,
          this.state.currentMeasurement,
          transform
        );
      }

      ctx.restore();
    } catch (error) {
      console.error("측정 렌더링 오류:", error);
    } finally {
      // 비동기로 플래그 해제
      setTimeout(() => {
        this._isRendering = false;
      }, 10);
    }
  }

  /**
   * 측정 그리기
   */
  drawMeasurement(ctx, measurement, transform) {
    if (!this.imageDisplayModule?.imageData) return;

    // 기본 스타일
    ctx.strokeStyle = "#ff6b6b";
    ctx.fillStyle = "#ff6b6b";
    ctx.lineWidth = 2 / transform.scale;

    // 이미지 좌표를 로컬 좌표로 변환
    const points = measurement.points.map(p => ({
      x: p.imageX - this.imageDisplayModule.imageData.width / 2,
      y: p.imageY - this.imageDisplayModule.imageData.height / 2,
    }));

    switch (measurement.type) {
      case "distance":
        this.drawLine(ctx, points[0], points[1]);
        this.drawPoints(ctx, points, transform);
        this.drawLabel(
          ctx,
          measurement.label,
          (points[0].x + points[1].x) / 2,
          (points[0].y + points[1].y) / 2,
          transform
        );
        break;

      case "angle":
        this.drawLine(ctx, points[1], points[0]);
        this.drawLine(ctx, points[1], points[2]);
        this.drawPoints(ctx, points, transform);
        this.drawLabel(
          ctx,
          measurement.label,
          points[1].x + 20 / transform.scale,
          points[1].y - 20 / transform.scale,
          transform
        );
        break;

      case "area":
        this.drawPolygon(ctx, points);
        this.drawPoints(ctx, points, transform);
        const center = this.getPolygonCenter(points);
        this.drawLabel(ctx, measurement.label, center.x, center.y, transform);
        break;
    }
  }

  /**
   * 현재 측정 그리기
   */
  drawCurrentMeasurement(ctx, measurement, transform) {
    if (!this.imageDisplayModule?.imageData) return;

    ctx.strokeStyle = "#4dabf7";
    ctx.fillStyle = "#4dabf7";
    ctx.lineWidth = 2 / transform.scale;

    const points = measurement.points.map(p => ({
      x: p.imageX - this.imageDisplayModule.imageData.width / 2,
      y: p.imageY - this.imageDisplayModule.imageData.height / 2,
    }));

    this.drawPoints(ctx, points, transform);

    if (points.length > 1) {
      for (let i = 0; i < points.length - 1; i++) {
        this.drawLine(ctx, points[i], points[i + 1]);
      }
    }
  }

  /**
   * 점들 그리기
   */
  drawPoints(ctx, points, transform) {
    const radius = 4 / transform.scale;
    points.forEach(point => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  /**
   * 다각형 그리기
   */
  drawPolygon(ctx, points) {
    if (points.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // 반투명 채우기
    ctx.save();
    ctx.fillStyle = "rgba(255, 107, 107, 0.2)";
    ctx.fill();
    ctx.restore();
  }

  /**
   * 라벨 그리기
   */
  drawLabel(ctx, text, x, y, transform) {
    const fontSize = 12 / transform.scale;
    ctx.font = `${fontSize}px Arial`;

    // 배경
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3 / transform.scale;

    const metrics = ctx.measureText(text);
    const padding = 4 / transform.scale;

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

  /**
   * 다각형 중심점 계산
   */
  getPolygonCenter(points) {
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { x, y };
  }

  /**
   * 측정 통계 가져오기
   */
  getMeasurementStatistics() {
    return {
      total: this.state.measurements.length,
      byType: {
        distance: this.state.measurements.filter(m => m.type === "distance")
          .length,
        angle: this.state.measurements.filter(m => m.type === "angle").length,
        area: this.state.measurements.filter(m => m.type === "area").length,
      },
    };
  }

  /**
   * 측정 내보내기
   */
  exportMeasurements(format = "json") {
    try {
      return measurementEngine.exportMeasurements(format);
    } catch (error) {
      errorHandler.handleError(error, {
        context: "측정 내보내기",
      });
      return null;
    }
  }

  /**
   * 측정 가져오기
   */
  importMeasurements(data, format = "json") {
    try {
      return measurementEngine.importMeasurements(data, format);
    } catch (error) {
      errorHandler.handleError(error, {
        context: "측정 가져오기",
      });
      return null;
    }
  }

  /**
   * 모듈 이벤트 핸들러
   */
  onActivate() {
    this.state.isEnabled = true;
    this.updateMeasurementInfo();
    // 활성화 시에는 렌더링하지 않음 (이미지 로드 후에만)
  }

  onDeactivate() {
    this.state.isEnabled = false;
    this.cancelCurrentMeasurement();
  }

  onImageLoaded(imageData) {
    // 이미지 로드 시 측정 초기화만 (렌더링은 별도로)
    this.cancelCurrentMeasurement();

    // 충분한 지연 후 렌더링 (이미지 모듈과 베이스 컨트롤러가 완전히 준비된 후)
    setTimeout(() => {
      if (this.state.isEnabled && this.imageDisplayModule?.imageData) {
        this.renderMeasurements();
      }
    }, 200);
  }

  onCanvasResize(size) {
    // 캔버스 크기 변경 시 지연 후 렌더링
    setTimeout(() => {
      if (this.state.isEnabled && this.imageDisplayModule?.imageData) {
        this.renderMeasurements();
      }
    }, 100);
  }

  /**
   * 현재 상태 가져오기
   */
  getState() {
    return {
      mode: this.state.mode,
      isEnabled: this.state.isEnabled,
      measurementCount: this.state.measurements.length,
      currentMeasurement: this.state.currentMeasurement
        ? {
            type: this.state.currentMeasurement.type,
            pointCount: this.state.currentMeasurement.points.length,
          }
        : null,
      statistics: this.getMeasurementStatistics(),
    };
  }

  /**
   * 정리
   */
  cleanup() {
    this.cancelCurrentMeasurement();
    this.state = {
      mode: null,
      currentMeasurement: null,
      isEnabled: true,
      measurements: [],
    };

    console.log("MeasurementModule 정리 완료");
  }
}

export default MeasurementModule;
