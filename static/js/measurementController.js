// measurementController.js - 측정 관련 기능들

import { getImagePoint, getScreenCoordinates } from './utils.js';

// 측정 도구 설정
export function setupMeasurementTools(img, viewer, controls) {
  // 거리 측정
  controls.measureDistance.addEventListener("click", () => {
    setMeasurementMode(viewer, "distance", controls);
  });

  // 각도 측정
  controls.measureAngle.addEventListener("click", () => {
    setMeasurementMode(viewer, "angle", controls);
  });

  // 면적 측정
  controls.measureArea.addEventListener("click", () => {
    setMeasurementMode(viewer, "area", controls);
  });
}

// 측정 모드 설정
export function setMeasurementMode(viewer, mode, controls) {
  const state = viewer.measurementState;
  const viewerState = viewer.viewerState;
  const img = viewer.querySelector("#dicomImage");

  // 선택 모드로 자동 전환
  if (viewerState.mode !== 'select') {
    window.setViewerMode(viewer, 'select', controls);
  }

  // 기존 선택 해제
  state.selectedMeasurement = null;
  state.selectedPointIndex = -1;
  viewer.shapeState.selectedShape = null;
  viewer.drawingState.selectedDrawing = null;

  // 다른 모드들 해제
  viewer.shapeState.mode = null;
  viewer.drawingState.mode = null;

  // 기존 측정 중단
  state.isDrawing = false;
  state.currentPoints = [];

  // 새 모드 설정
  state.mode = mode;

  // 커서 변경
  window.updateCursor(img, viewer);

  // 버튼 스타일 업데이트
  updateMeasurementButtons(mode, controls);
  window.updateShapeButtons && window.updateShapeButtons(null, controls);
  window.updateDrawingButtons && window.updateDrawingButtons(null, controls);

  // 안내 메시지 업데이트
  updateMeasurementInfo(mode, controls);
  window.updateShapeInfo && window.updateShapeInfo(null, controls);
  window.updateDrawingInfo && window.updateDrawingInfo(null, controls);
  updateSelectedMeasurementInfo(controls);

  // 화면 다시 그리기
  window.redrawMeasurements(viewer);
}

// 측정 버튼 스타일 업데이트
export function updateMeasurementButtons(activeMode, controls) {
  const buttons = [
    controls.measureDistance,
    controls.measureAngle,
    controls.measureArea,
  ];
  const modes = ["distance", "angle", "area"];

  buttons.forEach((btn, index) => {
    if (modes[index] === activeMode) {
      btn.classList.remove("bg-green-500");
      btn.classList.add("bg-green-700");
    } else {
      btn.classList.remove("bg-green-700");
      btn.classList.add("bg-green-500");
    }
  });
}

// 측정 정보 업데이트
export function updateMeasurementInfo(mode, controls) {
  const messages = {
    distance: "거리 측정 모드: 두 점을 클릭하세요",
    angle: "각도 측정 모드: 세 점을 순서대로 클릭하세요 (점1-꼭짓점-점2)",
    area: "면적 측정 모드: 영역의 경계를 클릭하세요 (우클릭으로 완료)",
  };

  if (mode) {
    controls.measurementInfo.innerHTML = `<span class="text-blue-600 font-medium">${messages[mode]}</span>`;
  } else {
    controls.measurementInfo.textContent = "측정 도구를 선택하거나 기존 측정을 클릭하세요";
  }
}

// 선택된 측정 정보 업데이트
export function updateSelectedMeasurementInfo(controls) {
  const info = controls.selectedMeasurementInfo;
  if (!info) return;

  const viewer = info.closest('#imageViewer');
  const measurementState = viewer?.measurementState;
  const viewerState = viewer?.viewerState;
  
  if (measurementState?.selectedMeasurement) {
    const m = measurementState.selectedMeasurement;
    const typeText = m.type === "distance" ? "거리" : m.type === "angle" ? "각도" : "면적";
    
    // 편집 중인지 확인
    const isEditing = viewerState?.isDragging && measurementState.selectedPointIndex >= 0;
    
    if (isEditing) {
      info.innerHTML = `<span class="text-orange-600 font-medium">편집 중: ${typeText} - ${m.label}</span>`;
    } else if (measurementState.mode) {
      // 측정 모드가 활성화된 경우
      info.innerHTML = `<span class="text-gray-500">측정 모드 활성화됨 (${typeText} - ${m.label} 선택됨)</span>`;
    } else {
      // 순수 선택 모드
      info.innerHTML = `<span class="text-green-600 font-medium">선택됨: ${typeText} - ${m.label}</span> <span class="text-gray-500">(점/선을 클릭하여 편집)</span>`;
    }
  } else {
    if (measurementState?.mode) {
      info.innerHTML = `<span class="text-blue-600">측정 모드 활성화됨</span>`;
    } else {
      info.textContent = "";
    }
  }
}

// 측정 클릭 처리
export function handleMeasurementClick(viewer, controls) {
  const state = viewer.measurementState;

  switch (state.mode) {
    case "distance":
      if (state.currentPoints.length === 2) {
        completeMeasurement(viewer, controls);
      }
      break;
    case "angle":
      if (state.currentPoints.length === 3) {
        completeMeasurement(viewer, controls);
      }
      break;
    case "area":
      // 면적은 우클릭으로 완료
      window.redrawMeasurements(viewer);
      break;
  }
}

// 측정 완료
export function completeMeasurement(viewer, controls) {
  const state = viewer.measurementState;
  const points = [...state.currentPoints];

  let measurement = {
    type: state.mode,
    points: points,
    id: Date.now(),
  };

  // 계산 수행
  recalculateMeasurement(measurement);

  // 측정 결과 저장
  state.measurements.push(measurement);

  // 상태 초기화 및 측정 모드 해제
  state.currentPoints = [];
  const completedType = state.mode;
  state.mode = null; // 측정 모드 해제

  // 방금 생성한 측정을 선택 상태로 설정
  state.selectedMeasurement = measurement;
  state.selectedPointIndex = -1;

  // 버튼 상태 업데이트
  updateMeasurementButtons(null, controls);

  // 화면 업데이트
  window.redrawMeasurements(viewer);
  updateMeasurementInfo(null, controls);
  updateSelectedMeasurementInfo(controls);

  // 결과 표시 (임시)
  showMeasurementResult(measurement, controls, completedType);

  // 커서 업데이트
  const img = viewer.querySelector("#dicomImage");
  window.updateCursor(img, viewer);
}

// 측정값 재계산
export function recalculateMeasurement(measurement) {
  switch (measurement.type) {
    case "distance":
      if (measurement.points.length >= 2) {
        measurement.value = calculateDistance(measurement.points[0], measurement.points[1]);
        measurement.label = `${measurement.value.toFixed(1)} px`;
      }
      break;
    case "angle":
      if (measurement.points.length >= 3) {
        measurement.value = calculateAngle(
          measurement.points[0],
          measurement.points[1],
          measurement.points[2]
        );
        measurement.label = `${measurement.value.toFixed(1)}°`;
      }
      break;
    case "area":
      if (measurement.points.length >= 3) {
        measurement.value = calculateArea(measurement.points);
        measurement.label = `${measurement.value.toFixed(1)} px²`;
      }
      break;
  }
}

// 거리 계산
export function calculateDistance(p1, p2) {
  const dx = p2.imageX - p1.imageX;
  const dy = p2.imageY - p1.imageY;
  return Math.sqrt(dx * dx + dy * dy);
}

// 각도 계산
export function calculateAngle(p1, vertex, p2) {
  // p1 -> vertex, p2 -> vertex 벡터 계산
  const v1x = p1.imageX - vertex.imageX;
  const v1y = p1.imageY - vertex.imageY;
  const v2x = p2.imageX - vertex.imageX;
  const v2y = p2.imageY - vertex.imageY;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);

  if (mag1 === 0 || mag2 === 0) return 0;

  const cosAngle = dot / (mag1 * mag2);
  return (Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180) / Math.PI;
}

// 면적 계산 (Shoelace formula)
export function calculateArea(points) {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].imageX * points[j].imageY;
    area -= points[j].imageX * points[i].imageY;
  }
  return Math.abs(area) / 2;
}

// 측정 결과 표시
export function showMeasurementResult(measurement, controls, completedType) {
  const info = controls.measurementInfo;
  const typeText = completedType === "distance" ? "거리" : completedType === "angle" ? "각도" : "면적";
  
  info.innerHTML = `
    <div class="bg-green-100 p-2 rounded text-center">
      <strong>${typeText} 측정 완료: ${measurement.label}</strong>
      <div class="text-xs text-gray-600 mt-1">측정이 선택되었습니다. 편집하려면 점/선을 클릭하세요.</div>
    </div>
  `;

  setTimeout(() => {
    updateMeasurementInfo(null, controls);
  }, 4000);
}

// 클릭된 측정 객체 확인
export function getClickedMeasurement(event, img, viewer) {
  const measurementState = viewer.measurementState;
  const point = getImagePoint(event, img, viewer);
  const clickRadius = 10;

  for (const measurement of measurementState.measurements) {
    const screenPoints = measurement.points.map((p) =>
      getScreenCoordinates(p.relativeX, p.relativeY, img, viewer)
    );

    // 점들 확인
    for (const screenPoint of screenPoints) {
      const distance = Math.sqrt(
        Math.pow(point.x - screenPoint.x, 2) + Math.pow(point.y - screenPoint.y, 2)
      );
      if (distance <= clickRadius) {
        return measurement;
      }
    }

    // 선/면적 영역 확인 (간단한 방식)
    if (measurement.type === 'distance' && screenPoints.length === 2) {
      if (isPointOnLine(point, screenPoints[0], screenPoints[1], clickRadius)) {
        return measurement;
      }
    }
  }

  return null;
}

// 클릭된 측정점 확인
export function getClickedMeasurementPoint(event, img, viewer, specificMeasurement = null) {
  const measurementState = viewer.measurementState;
  const point = getImagePoint(event, img, viewer);
  const clickRadius = 8; // 클릭 감지 반경

  // 특정 측정이 지정된 경우 해당 측정만 확인
  const measurementsToCheck = specificMeasurement ? [specificMeasurement] : measurementState.measurements;

  for (const measurement of measurementsToCheck) {
    for (let i = 0; i < measurement.points.length; i++) {
      const measurementPoint = measurement.points[i];
      const screenPoint = getScreenCoordinates(
        measurementPoint.relativeX,
        measurementPoint.relativeY,
        img,
        viewer
      );

      const distance = Math.sqrt(
        Math.pow(point.x - screenPoint.x, 2) + Math.pow(point.y - screenPoint.y, 2)
      );

      if (distance <= clickRadius) {
        return {
          measurement: measurement,
          pointIndex: i
        };
      }
    }

    // 선/면적 영역도 확인 (선택된 측정인 경우만)
    if (specificMeasurement && measurement === specificMeasurement) {
      const screenPoints = measurement.points.map((p) =>
        getScreenCoordinates(p.relativeX, p.relativeY, img, viewer)
      );

      if (measurement.type === 'distance' && screenPoints.length === 2) {
        if (isPointOnLine(point, screenPoints[0], screenPoints[1], 6)) {
          // 선 위를 클릭한 경우, 가장 가까운 점을 선택
          const dist1 = Math.sqrt(
            Math.pow(point.x - screenPoints[0].x, 2) + Math.pow(point.y - screenPoints[0].y, 2)
          );
          const dist2 = Math.sqrt(
            Math.pow(point.x - screenPoints[1].x, 2) + Math.pow(point.y - screenPoints[1].y, 2)
          );
          
          return {
            measurement: measurement,
            pointIndex: dist1 < dist2 ? 0 : 1
          };
        }
      }
    }
  }

  return null;
}

// 점이 선 위에 있는지 확인
export function isPointOnLine(point, lineStart, lineEnd, tolerance) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) return false;

  const param = dot / lenSq;
  
  if (param < 0 || param > 1) return false;

  const xx = lineStart.x + param * C;
  const yy = lineStart.y + param * D;

  const dx = point.x - xx;
  const dy = point.y - yy;
  
  return Math.sqrt(dx * dx + dy * dy) <= tolerance;
}

// 측정 지우기
export function clearMeasurements(viewer, controls) {
  const measurementState = viewer.measurementState;
  measurementState.measurements = [];
  measurementState.currentPoints = [];
  measurementState.selectedMeasurement = null;
  measurementState.selectedPointIndex = -1;
  measurementState.mode = null;

  updateMeasurementButtons(null, controls);
  updateMeasurementInfo(null, controls);
  updateSelectedMeasurementInfo(controls);
  window.redrawMeasurements(viewer);
}