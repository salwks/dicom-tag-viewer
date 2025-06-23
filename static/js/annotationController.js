// annotationController.js - 도형/드로잉 관련 기능들

import { getImagePoint, getScreenCoordinates } from './utils.js';

// 도형 도구 설정
export function setupShapeTools(img, viewer, controls) {
  // 사각형
  controls.shapeRectangle.addEventListener("click", () => {
    setShapeMode(viewer, "rectangle", controls);
  });

  // 원
  controls.shapeCircle.addEventListener("click", () => {
    setShapeMode(viewer, "circle", controls);
  });

  // 타원
  controls.shapeEllipse.addEventListener("click", () => {
    setShapeMode(viewer, "ellipse", controls);
  });

  // 화살표
  controls.shapeArrow.addEventListener("click", () => {
    setShapeMode(viewer, "arrow", controls);
  });
}

// 드로잉 도구 설정
export function setupDrawingTools(img, viewer, controls) {
  // 자유선
  controls.drawFreehand.addEventListener("click", () => {
    setDrawingMode(viewer, "freehand", controls);
  });

  // 직선
  controls.drawLine.addEventListener("click", () => {
    setDrawingMode(viewer, "line", controls);
  });

  // 텍스트
  controls.drawText.addEventListener("click", () => {
    setDrawingMode(viewer, "text", controls);
  });

  // 선 굵기 조정
  controls.strokeWidth.addEventListener("input", (e) => {
    const width = e.target.value;
    viewer.drawingState.strokeWidth = parseInt(width);
    controls.strokeWidthValue.textContent = width + "px";
  });

  // 색상 선택
  controls.strokeColor.addEventListener("change", (e) => {
    viewer.drawingState.strokeColor = e.target.value;
  });

  // 색상 버튼들
  controls.colorRed.addEventListener("click", () => {
    viewer.drawingState.strokeColor = "#ff0000";
    controls.strokeColor.value = "#ff0000";
  });

  controls.colorBlue.addEventListener("click", () => {
    viewer.drawingState.strokeColor = "#0000ff";
    controls.strokeColor.value = "#0000ff";
  });

  controls.colorGreen.addEventListener("click", () => {
    viewer.drawingState.strokeColor = "#00ff00";
    controls.strokeColor.value = "#00ff00";
  });

  controls.colorYellow.addEventListener("click", () => {
    viewer.drawingState.strokeColor = "#ffff00";
    controls.strokeColor.value = "#ffff00";
  });
}

// 도형 모드 설정
export function setShapeMode(viewer, mode, controls) {
  const shapeState = viewer.shapeState;
  const measurementState = viewer.measurementState;
  const drawingState = viewer.drawingState;
  const viewerState = viewer.viewerState;
  const img = viewer.querySelector("#dicomImage");

  // 선택 모드로 자동 전환
  if (viewerState.mode !== 'select') {
    window.setViewerMode(viewer, 'select', controls);
  }

  // 다른 모드들 해제
  measurementState.mode = null;
  drawingState.mode = null;
  
  // 기존 선택 해제
  shapeState.selectedShape = null;
  measurementState.selectedMeasurement = null;
  drawingState.selectedDrawing = null;

  // 도형 모드 설정
  shapeState.mode = mode;
  shapeState.isDrawing = false;
  shapeState.startPoint = null;
  shapeState.currentShape = null;

  // 커서 변경
  window.updateCursor(img, viewer);

  // 버튼 스타일 업데이트
  updateShapeButtons(mode, controls);
  window.updateMeasurementButtons && window.updateMeasurementButtons(null, controls);
  updateDrawingButtons(null, controls);

  // 안내 메시지 업데이트
  updateShapeInfo(mode, controls);
  window.updateMeasurementInfo && window.updateMeasurementInfo(null, controls);
  updateDrawingInfo(null, controls);
  window.updateSelectedMeasurementInfo && window.updateSelectedMeasurementInfo(controls);

  // 화면 다시 그리기
  window.redrawMeasurements(viewer);
}

// 드로잉 모드 설정
export function setDrawingMode(viewer, mode, controls) {
  const drawingState = viewer.drawingState;
  const measurementState = viewer.measurementState;
  const shapeState = viewer.shapeState;
  const viewerState = viewer.viewerState;
  const img = viewer.querySelector("#dicomImage");

  // 선택 모드로 자동 전환
  if (viewerState.mode !== 'select') {
    window.setViewerMode(viewer, 'select', controls);
  }

  // 다른 모드들 해제
  measurementState.mode = null;
  shapeState.mode = null;
  
  // 기존 선택 해제
  drawingState.selectedDrawing = null;
  measurementState.selectedMeasurement = null;
  shapeState.selectedShape = null;

  // 드로잉 모드 설정
  drawingState.mode = mode;
  drawingState.isDrawing = false;
  drawingState.currentPath = [];

  // 커서 변경
  window.updateCursor(img, viewer);

  // 버튼 스타일 업데이트
  updateDrawingButtons(mode, controls);
  window.updateMeasurementButtons && window.updateMeasurementButtons(null, controls);
  updateShapeButtons(null, controls);

  // 안내 메시지 업데이트
  updateDrawingInfo(mode, controls);
  window.updateMeasurementInfo && window.updateMeasurementInfo(null, controls);
  updateShapeInfo(null, controls);
  window.updateSelectedMeasurementInfo && window.updateSelectedMeasurementInfo(controls);

  // 화면 다시 그리기
  window.redrawMeasurements(viewer);
}

// 도형 버튼 스타일 업데이트
export function updateShapeButtons(activeMode, controls) {
  const buttons = [
    controls.shapeRectangle,
    controls.shapeCircle,
    controls.shapeEllipse,
    controls.shapeArrow,
  ];
  const modes = ["rectangle", "circle", "ellipse", "arrow"];

  buttons.forEach((btn, index) => {
    if (modes[index] === activeMode) {
      btn.classList.remove("bg-purple-500");
      btn.classList.add("bg-purple-700");
    } else {
      btn.classList.remove("bg-purple-700");
      btn.classList.add("bg-purple-500");
    }
  });
}

// 드로잉 버튼 스타일 업데이트
export function updateDrawingButtons(activeMode, controls) {
  const buttons = [
    controls.drawFreehand,
    controls.drawLine,
    controls.drawText,
  ];
  const modes = ["freehand", "line", "text"];

  buttons.forEach((btn, index) => {
    if (modes[index] === activeMode) {
      btn.classList.remove("bg-indigo-500");
      btn.classList.add("bg-indigo-700");
    } else {
// 드로잉 버튼 스타일 업데이트
export function updateDrawingButtons(activeMode, controls) {
  const buttons = [
    controls.drawFreehand,
    controls.drawLine,
    controls.drawText,
  ];
  const modes = ["freehand", "line", "text"];

  buttons.forEach((btn, index) => {
    if (modes[index] === activeMode) {
      btn.classList.remove("bg-indigo-500");
      btn.classList.add("bg-indigo-700");
    } else {
      btn.classList.remove("bg-indigo-700");
      btn.classList.add("bg-indigo-500");
    }
  });
}

// 도형 정보 업데이트
export function updateShapeInfo(mode, controls) {
  const messages = {
    rectangle: "사각형 모드: 클릭하고 드래그하여 사각형을 그리세요",
    circle: "원 모드: 클릭하고 드래그하여 원을 그리세요",
    ellipse: "타원 모드: 클릭하고 드래그하여 타원을 그리세요",
    arrow: "화살표 모드: 시작점과 끝점을 클릭하세요",
  };

  if (mode) {
    controls.shapeInfo.innerHTML = `<span class="text-purple-600 font-medium">${messages[mode]}</span>`;
  } else {
    controls.shapeInfo.textContent = "";
  }
}

// 드로잉 정보 업데이트
export function updateDrawingInfo(mode, controls) {
  const messages = {
    freehand: "자유선 모드: 클릭하고 드래그하여 자유롭게 그리세요",
    line: "직선 모드: 시작점과 끝점을 클릭하세요",
    text: "텍스트 모드: 클릭하여 텍스트를 입력하세요",
  };

  if (mode) {
    controls.drawInfo.innerHTML = `<span class="text-indigo-600 font-medium">${messages[mode]}</span>`;
  } else {
    controls.drawInfo.textContent = "";
  }
}

// 클릭된 도형 확인
export function getClickedShape(event, img, viewer) {
  const shapeState = viewer.shapeState;
  const point = getImagePoint(event, img, viewer);
  const clickRadius = 10;

  for (const shape of shapeState.shapes) {
    if (isPointInShape(point, shape, clickRadius)) {
      return shape;
    }
  }
  return null;
}

// 클릭된 드로잉 확인
export function getClickedDrawing(event, img, viewer) {
  const drawingState = viewer.drawingState;
  const point = getImagePoint(event, img, viewer);
  const clickRadius = 10;

  for (const drawing of drawingState.drawings) {
    if (isPointInDrawing(point, drawing, clickRadius)) {
      return drawing;
    }
  }
  return null;
}

// 점이 도형 안에 있는지 확인
export function isPointInShape(point, shape, tolerance) {
  if (shape.type === 'arrow') {
    // 화살표의 경우 선분과의 거리 확인
    const screenPoints = shape.points.map(p =>
      getScreenCoordinates(p.relativeX, p.relativeY, 
        document.querySelector("#dicomImage"), document.querySelector("#imageViewer"))
    );
    if (screenPoints.length >= 2) {
      return isPointOnLine(point, screenPoints[0], screenPoints[1], tolerance);
    }
    return false;
  }

  const screenStart = getScreenCoordinates(shape.startPoint.relativeX, shape.startPoint.relativeY, 
    document.querySelector("#dicomImage"), document.querySelector("#imageViewer"));
  const screenEnd = getScreenCoordinates(shape.endPoint.relativeX, shape.endPoint.relativeY,
    document.querySelector("#dicomImage"), document.querySelector("#imageViewer"));

  const left = Math.min(screenStart.x, screenEnd.x) - tolerance;
  const right = Math.max(screenStart.x, screenEnd.x) + tolerance;
  const top = Math.min(screenStart.y, screenEnd.y) - tolerance;
  const bottom = Math.max(screenStart.y, screenEnd.y) + tolerance;

  return point.x >= left && point.x <= right && point.y >= top && point.y <= bottom;
}

// 점이 드로잉 안에 있는지 확인
export function isPointInDrawing(point, drawing, tolerance) {
  if (drawing.type === 'text') {
    const screenPoint = getScreenCoordinates(drawing.point.relativeX, drawing.point.relativeY,
      document.querySelector("#dicomImage"), document.querySelector("#imageViewer"));
    const distance = Math.sqrt(
      Math.pow(point.x - screenPoint.x, 2) + Math.pow(point.y - screenPoint.y, 2)
    );
    return distance <= tolerance * 2;
  } else {
    // 선이나 자유선의 경우 경로상의 점들과 거리 체크
    for (let i = 0; i < drawing.path.length - 1; i++) {
      const screenStart = getScreenCoordinates(drawing.path[i].relativeX, drawing.path[i].relativeY,
        document.querySelector("#dicomImage"), document.querySelector("#imageViewer"));
      const screenEnd = getScreenCoordinates(drawing.path[i + 1].relativeX, drawing.path[i + 1].relativeY,
        document.querySelector("#dicomImage"), document.querySelector("#imageViewer"));
      
      if (isPointOnLine(point, screenStart, screenEnd, tolerance)) {
        return true;
      }
    }
  }
  return false;
}

// 점이 선 위에 있는지 확인 (유틸리티 함수)
function isPointOnLine(point, lineStart, lineEnd, tolerance) {
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

// 도형 그리기
export function drawShape(ctx, shape, img, viewer, isSelected = false, isDrawing = false) {
  const strokeColor = isSelected ? "#ff0000" : (isDrawing ? "#4dabf7" : "#9333ea");
  const lineWidth = isSelected ? 3 : 2;
  
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.fillStyle = isSelected ? "rgba(255, 0, 0, 0.1)" : "rgba(147, 51, 234, 0.1)";

  if (shape.type === 'arrow') {
    // 화살표 그리기
    const screenPoints = shape.points.map(point =>
      getScreenCoordinates(point.relativeX, point.relativeY, img, viewer)
    );
    
    if (screenPoints.length >= 2) {
      drawArrow(ctx, screenPoints[0], screenPoints[1]);
    }
  } else if (shape.startPoint && shape.endPoint) {
    // 사각형, 원, 타원 그리기
    const screenStart = getScreenCoordinates(shape.startPoint.relativeX, shape.startPoint.relativeY, img, viewer);
    const screenEnd = getScreenCoordinates(shape.endPoint.relativeX, shape.endPoint.relativeY, img, viewer);
    
    const x = Math.min(screenStart.x, screenEnd.x);
    const y = Math.min(screenStart.y, screenEnd.y);
    const width = Math.abs(screenEnd.x - screenStart.x);
    const height = Math.abs(screenEnd.y - screenStart.y);

    ctx.beginPath();
    
    switch (shape.type) {
      case 'rectangle':
        ctx.rect(x, y, width, height);
        ctx.stroke();
        ctx.fill();
        break;
        
      case 'circle':
        const radius = Math.min(width, height) / 2;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fill();
        break;
        
      case 'ellipse':
        const radiusX = width / 2;
        const radiusY = height / 2;
        const ellipseCenterX = x + radiusX;
        const ellipseCenterY = y + radiusY;
        ctx.ellipse(ellipseCenterX, ellipseCenterY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fill();
        break;
    }
  }
}

// 화살표 그리기 헬퍼 함수
export function drawArrow(ctx, start, end) {
  const headlen = 15; // 화살표 머리 길이
  const angle = Math.atan2(end.y - start.y, end.x - start.x);

  // 화살표 선 그리기
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // 화살표 머리 그리기
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), 
             end.y - headlen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6),
             end.y - headlen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
}

// 드로잉 그리기
export function drawDrawing(ctx, drawing, img, viewer, isSelected = false) {
  const strokeColor = isSelected ? "#ff0000" : drawing.strokeColor;
  const lineWidth = isSelected ? drawing.strokeWidth + 1 : drawing.strokeWidth;
  
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (drawing.type === 'text') {
    // 텍스트 그리기
    const screenPoint = getScreenCoordinates(drawing.point.relativeX, drawing.point.relativeY, img, viewer);
    
    ctx.font = `${drawing.fontSize}px Arial`;
    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // 배경 그리기
    const metrics = ctx.measureText(drawing.text);
    const padding = 4;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(screenPoint.x - padding, screenPoint.y - padding, 
                 metrics.width + 2 * padding, drawing.fontSize + 2 * padding);
    
    // 텍스트 그리기
    ctx.fillStyle = strokeColor;
    ctx.fillText(drawing.text, screenPoint.x, screenPoint.y);
    
    if (isSelected) {
      // 선택된 텍스트 테두리 그리기
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 2;
      ctx.strokeRect(screenPoint.x - padding, screenPoint.y - padding,
                     metrics.width + 2 * padding, drawing.fontSize + 2 * padding);
    }
  } else {
    // 선 그리기 (자유선 또는 직선)
    if (drawing.path.length > 1) {
      ctx.beginPath();
      const screenPoints = drawing.path.map(point =>
        getScreenCoordinates(point.relativeX, point.relativeY, img, viewer)
      );
      
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i++) {
        ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
      ctx.stroke();
    }
  }
}

// 현재 그리는 중인 드로잉 그리기
export function drawCurrentDrawing(ctx, drawingState, img, viewer) {
  if (drawingState.currentPath.length < 2) return;

  ctx.strokeStyle = "#4dabf7";
  ctx.lineWidth = drawingState.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const screenPoints = drawingState.currentPath.map(point =>
    getScreenCoordinates(point.relativeX, point.relativeY, img, viewer)
  );

  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  ctx.stroke();
}

// 도형 지우기
export function clearShapes(viewer, controls) {
  const shapeState = viewer.shapeState;
  shapeState.shapes = [];
  shapeState.selectedShape = null;
  shapeState.currentShape = null;
  shapeState.mode = null;
  shapeState.isDrawing = false;

  updateShapeButtons(null, controls);
  updateShapeInfo(null, controls);
  window.redrawMeasurements(viewer);
  
  const img = viewer.querySelector("#dicomImage");
  window.updateCursor(img, viewer);
}

// 드로잉 지우기
export function clearDrawings(viewer, controls) {
  const drawingState = viewer.drawingState;
  drawingState.drawings = [];
  drawingState.selectedDrawing = null;
  drawingState.currentPath = [];
  drawingState.mode = null;
  drawingState.isDrawing = false;

  updateDrawingButtons(null, controls);
  updateDrawingInfo(null, controls);
  window.redrawMeasurements(viewer);
  
  const img = viewer.querySelector("#dicomImage");
  window.updateCursor(img, viewer);
}