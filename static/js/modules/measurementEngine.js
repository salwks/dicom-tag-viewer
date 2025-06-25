/**
 * 측정 엔진
 * 의료영상에서의 정확한 측정 계산을 담당
 */

import { appState } from "../core/appStateManager.js";

class MeasurementEngine {
  constructor() {
    this.measurements = new Map();
    this.pixelSpacing = null; // [행간격, 열간격] mm/pixel
    this.measurementId = 0;
    this.calibration = null;
  }

  /**
   * 픽셀 간격 설정
   * @param {Array|string} pixelSpacing - DICOM PixelSpacing 값
   */
  setPixelSpacing(pixelSpacing) {
    if (typeof pixelSpacing === "string") {
      try {
        // "0.5\0.5" 형태의 문자열 파싱
        const values = pixelSpacing
          .split("\\")
          .map((v) => parseFloat(v.trim()));
        if (values.length === 2 && values.every((v) => !isNaN(v))) {
          this.pixelSpacing = values;
        }
      } catch (error) {
        console.warn("Invalid PixelSpacing format:", pixelSpacing);
      }
    } else if (Array.isArray(pixelSpacing) && pixelSpacing.length === 2) {
      this.pixelSpacing = pixelSpacing.map((v) => parseFloat(v));
    }

    // 기존 측정값들 재계산
    if (this.measurements.size > 0) {
      this.recalculateAllMeasurements();
    }
  }

  /**
   * 거리 측정 생성
   * @param {Array} points - 측정점 배열 [point1, point2]
   * @param {Object} options - 옵션
   * @returns {Object} 측정 객체
   */
  createDistanceMeasurement(points, options = {}) {
    if (points.length !== 2) {
      throw new Error("거리 측정에는 정확히 2개의 점이 필요합니다.");
    }

    const measurement = {
      id: ++this.measurementId,
      type: "distance",
      points: points.map((p) => this.normalizePoint(p)),
      createdAt: new Date(),
      options,
      ...this.calculateDistance(points),
    };

    this.measurements.set(measurement.id, measurement);
    this.updateAppState();

    return measurement;
  }

  /**
   * 각도 측정 생성
   * @param {Array} points - 측정점 배열 [point1, vertex, point2]
   * @param {Object} options - 옵션
   * @returns {Object} 측정 객체
   */
  createAngleMeasurement(points, options = {}) {
    if (points.length !== 3) {
      throw new Error("각도 측정에는 정확히 3개의 점이 필요합니다.");
    }

    const measurement = {
      id: ++this.measurementId,
      type: "angle",
      points: points.map((p) => this.normalizePoint(p)),
      createdAt: new Date(),
      options,
      ...this.calculateAngle(points),
    };

    this.measurements.set(measurement.id, measurement);
    this.updateAppState();

    return measurement;
  }

  /**
   * 면적 측정 생성
   * @param {Array} points - 측정점 배열 (3개 이상)
   * @param {Object} options - 옵션
   * @returns {Object} 측정 객체
   */
  createAreaMeasurement(points, options = {}) {
    if (points.length < 3) {
      throw new Error("면적 측정에는 최소 3개의 점이 필요합니다.");
    }

    const measurement = {
      id: ++this.measurementId,
      type: "area",
      points: points.map((p) => this.normalizePoint(p)),
      createdAt: new Date(),
      options,
      ...this.calculateArea(points),
    };

    this.measurements.set(measurement.id, measurement);
    this.updateAppState();

    return measurement;
  }

  /**
   * 거리 계산
   * @param {Array} points - 점 배열
   * @returns {Object} 계산 결과
   */
  calculateDistance(points) {
    const [p1, p2] = points;

    // 픽셀 단위 거리
    const dx = p2.imageX - p1.imageX;
    const dy = p2.imageY - p1.imageY;
    const pixelDistance = Math.sqrt(dx * dx + dy * dy);

    let realDistance = null;
    let unit = "px";

    // 실제 거리 계산 (PixelSpacing이 있는 경우)
    if (this.pixelSpacing) {
      const [rowSpacing, colSpacing] = this.pixelSpacing;
      const realDx = dx * colSpacing; // 열 방향
      const realDy = dy * rowSpacing; // 행 방향
      realDistance = Math.sqrt(realDx * realDx + realDy * realDy);
      unit = "mm";
    }

    return {
      pixelDistance,
      realDistance,
      unit,
      value: realDistance || pixelDistance,
      label: this.formatMeasurementLabel(realDistance || pixelDistance, unit),
      details: {
        deltaX: dx,
        deltaY: dy,
        pixelSpacing: this.pixelSpacing,
      },
    };
  }

  /**
   * 각도 계산
   * @param {Array} points - 점 배열 [point1, vertex, point2]
   * @returns {Object} 계산 결과
   */
  calculateAngle(points) {
    const [p1, vertex, p2] = points;

    // 벡터 계산
    const v1x = p1.imageX - vertex.imageX;
    const v1y = p1.imageY - vertex.imageY;
    const v2x = p2.imageX - vertex.imageX;
    const v2y = p2.imageY - vertex.imageY;

    // 각도 계산 (라디안)
    const dot = v1x * v2x + v1y * v2y;
    const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
    const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

    if (mag1 === 0 || mag2 === 0) {
      return {
        angle: 0,
        value: 0,
        label: "0.0°",
        unit: "°",
        details: {
          vectors: { v1: [v1x, v1y], v2: [v2x, v2y] },
          magnitudes: [mag1, mag2],
        },
      };
    }

    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const angleRad = Math.acos(cosAngle);
    const angleDeg = (angleRad * 180) / Math.PI;

    // 외각/내각 선택 (옵션에 따라)
    const finalAngle = angleDeg > 180 ? 360 - angleDeg : angleDeg;

    return {
      angle: finalAngle,
      angleRad,
      value: finalAngle,
      label: this.formatMeasurementLabel(finalAngle, "°"),
      unit: "°",
      details: {
        vectors: { v1: [v1x, v1y], v2: [v2x, v2y] },
        magnitudes: [mag1, mag2],
        dotProduct: dot,
        cosAngle,
      },
    };
  }

  /**
   * 면적 계산 (Shoelace 공식)
   * @param {Array} points - 점 배열
   * @returns {Object} 계산 결과
   */
  calculateArea(points) {
    // 픽셀 단위 면적 (Shoelace 공식)
    let pixelArea = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      pixelArea += points[i].imageX * points[j].imageY;
      pixelArea -= points[j].imageX * points[i].imageY;
    }
    pixelArea = Math.abs(pixelArea) / 2;

    let realArea = null;
    let unit = "px²";

    // 실제 면적 계산
    if (this.pixelSpacing) {
      const [rowSpacing, colSpacing] = this.pixelSpacing;
      realArea = pixelArea * rowSpacing * colSpacing;
      unit = "mm²";
    }

    return {
      pixelArea,
      realArea,
      unit,
      value: realArea || pixelArea,
      label: this.formatMeasurementLabel(realArea || pixelArea, unit),
      details: {
        pixelSpacing: this.pixelSpacing,
        pointCount: points.length,
        perimeter: this.calculatePerimeter(points),
      },
    };
  }

  /**
   * 둘레 계산
   * @param {Array} points - 점 배열
   * @returns {Object} 둘레 정보
   */
  calculatePerimeter(points) {
    let pixelPerimeter = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const dx = points[j].imageX - points[i].imageX;
      const dy = points[j].imageY - points[i].imageY;
      pixelPerimeter += Math.sqrt(dx * dx + dy * dy);
    }

    let realPerimeter = null;
    if (this.pixelSpacing) {
      const [rowSpacing, colSpacing] = this.pixelSpacing;
      // 근사치 계산 (실제로는 각 세그먼트별로 계산해야 함)
      realPerimeter = pixelPerimeter * Math.sqrt(rowSpacing * colSpacing);
    }

    return {
      pixelPerimeter,
      realPerimeter,
      unit: this.pixelSpacing ? "mm" : "px",
    };
  }

  /**
   * 측정 업데이트
   * @param {number} id - 측정 ID
   * @param {Array} newPoints - 새로운 점 배열
   * @returns {Object} 업데이트된 측정
   */
  updateMeasurement(id, newPoints) {
    const measurement = this.measurements.get(id);
    if (!measurement) {
      throw new Error(`측정 ID ${id}를 찾을 수 없습니다.`);
    }

    measurement.points = newPoints.map((p) => this.normalizePoint(p));
    measurement.updatedAt = new Date();

    // 측정값 재계산
    switch (measurement.type) {
      case "distance":
        Object.assign(measurement, this.calculateDistance(newPoints));
        break;
      case "angle":
        Object.assign(measurement, this.calculateAngle(newPoints));
        break;
      case "area":
        Object.assign(measurement, this.calculateArea(newPoints));
        break;
    }

    this.updateAppState();
    return measurement;
  }

  /**
   * 측정 삭제
   * @param {number} id - 측정 ID
   * @returns {boolean} 삭제 성공 여부
   */
  deleteMeasurement(id) {
    const success = this.measurements.delete(id);
    if (success) {
      this.updateAppState();
    }
    return success;
  }

  /**
   * 모든 측정 클리어
   */
  clearAllMeasurements() {
    this.measurements.clear();
    this.updateAppState();
  }

  /**
   * 측정 가져오기
   * @param {number} id - 측정 ID
   * @returns {Object|null} 측정 객체
   */
  getMeasurement(id) {
    return this.measurements.get(id) || null;
  }

  /**
   * 모든 측정 가져오기
   * @returns {Array} 측정 배열
   */
  getAllMeasurements() {
    return Array.from(this.measurements.values());
  }

  /**
   * 타입별 측정 가져오기
   * @param {string} type - 측정 타입
   * @returns {Array} 해당 타입의 측정 배열
   */
  getMeasurementsByType(type) {
    return this.getAllMeasurements().filter((m) => m.type === type);
  }

  /**
   * 점 정규화
   * @param {Object} point - 원본 점
   * @returns {Object} 정규화된 점
   */
  normalizePoint(point) {
    return {
      x: point.x || 0,
      y: point.y || 0,
      imageX: point.imageX || point.x || 0,
      imageY: point.imageY || point.y || 0,
      relativeX: point.relativeX || 0,
      relativeY: point.relativeY || 0,
      timestamp: point.timestamp || Date.now(),
    };
  }

  /**
   * 측정 라벨 포맷팅
   * @param {number} value - 측정값
   * @param {string} unit - 단위
   * @returns {string} 포맷된 라벨
   */
  formatMeasurementLabel(value, unit) {
    if (unit === "°") {
      return `${value.toFixed(1)}°`;
    } else if (unit === "mm") {
      if (value >= 10) {
        return `${value.toFixed(1)} mm`;
      } else {
        return `${value.toFixed(2)} mm`;
      }
    } else if (unit === "mm²") {
      if (value >= 100) {
        return `${value.toFixed(1)} mm²`;
      } else {
        return `${value.toFixed(2)} mm²`;
      }
    } else {
      return `${value.toFixed(1)} ${unit}`;
    }
  }

  /**
   * 앱 상태 업데이트
   */
  updateAppState() {
    const measurements = this.getAllMeasurements();
    appState.setState("viewer.measurements", measurements);
  }

  /**
   * 측정값 통계 계산
   * @param {string} type - 측정 타입 (optional)
   * @returns {Object} 통계 정보
   */
  getStatistics(type = null) {
    let measurements = this.getAllMeasurements();

    if (type) {
      measurements = measurements.filter((m) => m.type === type);
    }

    if (measurements.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        standardDeviation: 0,
      };
    }

    const values = measurements.map((m) => m.value);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / count;
    const min = Math.min(...values);
    const max = Math.max(...values);

    // 표준편차 계산
    const variance =
      values.reduce((acc, val) => acc + Math.pow(val - average, 2), 0) / count;
    const standardDeviation = Math.sqrt(variance);

    return {
      count,
      average,
      min,
      max,
      sum,
      standardDeviation,
      unit: measurements[0]?.unit || "px",
    };
  }

  /**
   * 측정 데이터 내보내기
   * @param {string} format - 내보내기 형식 ('json', 'csv')
   * @returns {string} 내보낸 데이터
   */
  exportMeasurements(format = "json") {
    const measurements = this.getAllMeasurements();

    if (format === "csv") {
      const headers = ["ID", "Type", "Value", "Unit", "Created", "Points"];
      const rows = measurements.map((m) => [
        m.id,
        m.type,
        m.value.toFixed(3),
        m.unit,
        m.createdAt.toISOString(),
        JSON.stringify(m.points),
      ]);

      return [headers, ...rows].map((row) => row.join(",")).join("\n");
    } else {
      return JSON.stringify(measurements, null, 2);
    }
  }

  /**
   * 측정 데이터 가져오기
   * @param {string} data - 가져올 데이터
   * @param {string} format - 데이터 형식
   * @returns {Array} 가져온 측정 배열
   */
  importMeasurements(data, format = "json") {
    try {
      let importedMeasurements = [];

      if (format === "json") {
        importedMeasurements = JSON.parse(data);
      } else if (format === "csv") {
        const lines = data.split("\n");
        const headers = lines[0].split(",");

        importedMeasurements = lines.slice(1).map((line) => {
          const values = line.split(",");
          return {
            id: parseInt(values[0]),
            type: values[1],
            value: parseFloat(values[2]),
            unit: values[3],
            createdAt: new Date(values[4]),
            points: JSON.parse(values[5]),
          };
        });
      }

      // 기존 측정과 ID 충돌 방지
      importedMeasurements.forEach((measurement) => {
        const newId = ++this.measurementId;
        measurement.id = newId;
        measurement.importedAt = new Date();
        this.measurements.set(newId, measurement);
      });

      this.updateAppState();
      return importedMeasurements;
    } catch (error) {
      throw new Error(`측정 데이터 가져오기 실패: ${error.message}`);
    }
  }

  /**
   * 측정점 간 거리 계산 (유틸리티)
   * @param {Object} p1 - 첫 번째 점
   * @param {Object} p2 - 두 번째 점
   * @returns {number} 픽셀 거리
   */
  static getPixelDistance(p1, p2) {
    const dx = p2.imageX - p1.imageX;
    const dy = p2.imageY - p1.imageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 점이 다각형 내부에 있는지 확인
   * @param {Object} point - 확인할 점
   * @param {Array} polygonPoints - 다각형 점들
   * @returns {boolean} 내부 여부
   */
  static isPointInPolygon(point, polygonPoints) {
    let inside = false;
    const x = point.imageX;
    const y = point.imageY;

    for (
      let i = 0, j = polygonPoints.length - 1;
      i < polygonPoints.length;
      j = i++
    ) {
      const xi = polygonPoints[i].imageX;
      const yi = polygonPoints[i].imageY;
      const xj = polygonPoints[j].imageX;
      const yj = polygonPoints[j].imageY;

      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * 점과 선분 간의 최단거리 계산
   * @param {Object} point - 점
   * @param {Object} lineStart - 선분 시작점
   * @param {Object} lineEnd - 선분 끝점
   * @returns {number} 최단거리
   */
  static getPointToLineDistance(point, lineStart, lineEnd) {
    const A = point.imageX - lineStart.imageX;
    const B = point.imageY - lineStart.imageY;
    const C = lineEnd.imageX - lineStart.imageX;
    const D = lineEnd.imageY - lineStart.imageY;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {
      return Math.sqrt(A * A + B * B);
    }

    let param = dot / lenSq;
    param = Math.max(0, Math.min(1, param));

    const xx = lineStart.imageX + param * C;
    const yy = lineStart.imageY + param * D;

    const dx = point.imageX - xx;
    const dy = point.imageY - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 캘리브레이션 정보 설정
   * @param {Object} calibration - 캘리브레이션 정보
   */
  setCalibration(calibration) {
    this.calibration = calibration;

    if (calibration.pixelSpacing) {
      this.setPixelSpacing(calibration.pixelSpacing);
    }

    this.imageOrientation = calibration.imageOrientation;
    this.sliceThickness = calibration.sliceThickness;

    // 기존 측정값들 재계산
    this.recalculateAllMeasurements();
  }

  /**
   * 모든 측정값 재계산
   */
  recalculateAllMeasurements() {
    for (const measurement of this.measurements.values()) {
      const points = measurement.points;

      switch (measurement.type) {
        case "distance":
          Object.assign(measurement, this.calculateDistance(points));
          break;
        case "angle":
          Object.assign(measurement, this.calculateAngle(points));
          break;
        case "area":
          Object.assign(measurement, this.calculateArea(points));
          break;
      }

      measurement.updatedAt = new Date();
    }

    this.updateAppState();
  }

  /**
   * 측정 검색
   * @param {string} query - 검색 쿼리
   * @returns {Array} 검색 결과
   */
  searchMeasurements(query) {
    const lowercaseQuery = query.toLowerCase();
    return this.getAllMeasurements().filter((measurement) => {
      return (
        measurement.type.toLowerCase().includes(lowercaseQuery) ||
        measurement.label.toLowerCase().includes(lowercaseQuery) ||
        measurement.id.toString().includes(query)
      );
    });
  }

  /**
   * 측정 정렬
   * @param {string} sortBy - 정렬 기준 ('id', 'type', 'value', 'createdAt')
   * @param {string} order - 정렬 순서 ('asc', 'desc')
   * @returns {Array} 정렬된 측정 배열
   */
  sortMeasurements(sortBy = "createdAt", order = "desc") {
    const measurements = this.getAllMeasurements();

    return measurements.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "id":
          comparison = a.id - b.id;
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "value":
          comparison = a.value - b.value;
          break;
        case "createdAt":
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        default:
          comparison = 0;
      }

      return order === "desc" ? -comparison : comparison;
    });
  }

  /**
   * 측정 복제
   * @param {number} id - 복제할 측정 ID
   * @returns {Object} 복제된 측정
   */
  duplicateMeasurement(id) {
    const original = this.measurements.get(id);
    if (!original) {
      throw new Error(`측정 ID ${id}를 찾을 수 없습니다.`);
    }

    const duplicate = {
      ...original,
      id: ++this.measurementId,
      createdAt: new Date(),
      duplicatedFrom: id,
    };

    this.measurements.set(duplicate.id, duplicate);
    this.updateAppState();

    return duplicate;
  }

  /**
   * 측정 그룹화
   * @param {Array} measurementIds - 그룹화할 측정 ID 배열
   * @param {string} groupName - 그룹 이름
   * @returns {Object} 그룹 정보
   */
  createMeasurementGroup(measurementIds, groupName) {
    const group = {
      id: `group_${Date.now()}`,
      name: groupName,
      measurementIds: measurementIds,
      createdAt: new Date(),
    };

    // 각 측정에 그룹 정보 추가
    measurementIds.forEach((id) => {
      const measurement = this.measurements.get(id);
      if (measurement) {
        measurement.groupId = group.id;
      }
    });

    this.updateAppState();
    return group;
  }

  /**
   * 정리 (메모리 해제)
   */
  cleanup() {
    this.measurements.clear();
    this.pixelSpacing = null;
    this.calibration = null;
    this.measurementId = 0;
    this.updateAppState();
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const measurementEngine = new MeasurementEngine();

// 개발 모드에서 전역 객체에 추가
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  window.measurementEngine = measurementEngine;
}
