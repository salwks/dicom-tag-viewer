// viewerController.js - 영상 뷰어 관리

export function showViewer() {
  // 탭 전환
  document.getElementById("dicomTree").classList.add("hidden");
  document.getElementById("tagTableContainer").classList.add("hidden");
  document.getElementById("imageViewer").classList.remove("hidden");

  const viewer = document.getElementById("imageViewer");
  const img = document.getElementById("dicomImage");
  const file = window.previewFile;

  if (!file) return alert("파일이 없습니다.");

  // 기존 컨트롤 제거
  removeExistingControls(viewer);

  // 이미지 컨트롤 UI 생성
  createImageControls(viewer);

  // 이미지 로드 및 초기화
  loadDicomImage(img, viewer, file);
}

// 기존 컨트롤 제거
function removeExistingControls(viewer) {
  const existingControls = viewer.querySelector(".image-controls");
  if (existingControls) existingControls.remove();
}

// 이미지 컨트롤 UI 생성
function createImageControls(viewer) {
  const controls = document.createElement("div");
  controls.className =
    "image-controls absolute top-4 left-4 bg-white p-4 rounded-lg shadow-lg z-10";
  controls.innerHTML = `
    <div class="flex flex-col space-y-3">
      <!-- 모드 선택 (새로 추가) -->
      <div class="border-b pb-3">
        <label class="text-sm font-medium mb-2 block">모드 선택:</label>
        <div class="flex flex-wrap gap-2">
          <button id="modeSelect" class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 mode-active">선택</button>
          <button id="modePan" class="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">이동</button>
        </div>
      </div>

      <!-- 줌 컨트롤 -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium w-12">줌:</label>
        <button id="zoomOut" class="px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">-</button>
        <span id="zoomValue" class="text-sm w-12 text-center">100%</span>
        <button id="zoomIn" class="px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">+</button>
        <button id="zoomFit" class="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">맞춤</button>
        <button id="zoom100" class="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">100%</button>
      </div>
      
      <!-- 밝기 조정 -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium w-12">밝기:</label>
        <input type="range" id="brightnessSlider" min="0" max="200" value="100" class="flex-1">
        <span id="brightnessValue" class="text-sm w-12 text-center">100%</span>
      </div>
      
      <!-- 대비 조정 -->
      <div class="flex items-center space-x-2">
        <label class="text-sm font-medium w-12">대비:</label>
        <input type="range" id="contrastSlider" min="0" max="200" value="100" class="flex-1">
        <span id="contrastValue" class="text-sm w-12 text-center">100%</span>
      </div>
      
      <!-- 측정 도구 -->
      <div class="border-t pt-3">
        <label class="text-sm font-medium mb-2 block">측정 도구:</label>
        <div class="flex flex-wrap gap-1">
          <button id="measureDistance" class="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">거리</button>
          <button id="measureAngle" class="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">각도</button>
          <button id="measureArea" class="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600">면적</button>
          <button id="clearMeasurements" class="px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600">지우기</button>
        </div>
        <div id="measurementInfo" class="text-xs text-gray-600 mt-2 min-h-[20px]"></div>
        <div id="selectedMeasurementInfo" class="text-xs text-blue-600 mt-1 min-h-[16px]"></div>
      </div>
      
      <!-- 리셋 버튼 -->
      <button id="resetAll" class="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">초기화</button>
    </div>
  `;

  viewer.appendChild(controls);
}

// DICOM 이미지 로드
function loadDicomImage(img, viewer, file) {
  // 로딩 상태 설정
  img.src = "";
  img.style.display = "none";

  // 로딩 스피너 표시
  showLoadingSpinner(viewer);

  const formData = new FormData();
  formData.append("file", file);

  fetch("/preview", {
    method: "POST",
    body: formData,
  })
    .then((res) => res.blob())
    .then((blob) => {
      const imageUrl = URL.createObjectURL(blob);

      // 이미지 로드 완료 후 초기화
      img.onload = function () {
        hideLoadingSpinner(viewer);
        img.style.display = "block";

        // 이미지 뷰어 초기화
        initializeImageViewer(img, viewer);
        setupImageControls(img, viewer);
      };

      img.src = imageUrl;
    })
    .catch((err) => {
      console.error("이미지 표시 오류:", err);
      hideLoadingSpinner(viewer);
      showErrorMessage(viewer, err);
    });
}

// 로딩 스피너 표시
function showLoadingSpinner(viewer) {
  const existingSpinner = viewer.querySelector(".loading-spinner");
  if (!existingSpinner) {
    const spinner = document.createElement("div");
    spinner.className =
      "loading-spinner flex flex-col items-center justify-center";
    spinner.innerHTML = `
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
      <p class="text-gray-600">영상을 불러오는 중...</p>
    `;
    viewer.appendChild(spinner);
  }
}

// 로딩 스피너 숨김
function hideLoadingSpinner(viewer) {
  const spinner = viewer.querySelector(".loading-spinner");
  if (spinner) spinner.remove();
}

// 에러 메시지 표시
function showErrorMessage(viewer, err) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "flex flex-col items-center justify-center text-red-500";
  errorDiv.innerHTML = `
    <div class="text-4xl mb-4">⚠️</div>
    <p class="text-lg font-semibold mb-2">영상 로드 실패</p>
    <p class="text-sm text-gray-600">${
      err.message || "알 수 없는 오류가 발생했습니다."
    }</p>
  `;
  viewer.appendChild(errorDiv);
}

// 이미지 뷰어 초기화
function initializeImageViewer(img, viewer) {
  // 초기 상태 저장
  img.dataset.originalWidth = img.naturalWidth;
  img.dataset.originalHeight = img.naturalHeight;
  img.dataset.scale = "1";
  img.dataset.brightness = "100";
  img.dataset.contrast = "100";

  // 뷰어 상태 초기화
  viewer.viewerState = {
    mode: "select", // 'select', 'pan'
    isDragging: false,
    dragTarget: null, // 'image' or measurement object
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  };

  // 측정 상태 초기화
  viewer.measurementState = {
    mode: null, // 'distance', 'angle', 'area', null
    isDrawing: false,
    currentPoints: [],
    measurements: [],
    selectedMeasurement: null,
    selectedPointIndex: -1,
  };

  // 초기 크기 설정 (fit to container)
  fitImageToContainer(img, viewer);

  // 이벤트 설정
  setupImageEvents(img, viewer);

  // 측정 오버레이 캔버스 생성
  createMeasurementCanvas(viewer);
}

// 컨테이너에 맞춤
function fitImageToContainer(img, viewer) {
  const containerWidth = viewer.clientWidth - 32; // padding 고려
  const containerHeight = viewer.clientHeight - 120; // 컨트롤 영역 고려

  const imgWidth = parseInt(img.dataset.originalWidth);
  const imgHeight = parseInt(img.dataset.originalHeight);

  const widthRatio = containerWidth / imgWidth;
  const heightRatio = containerHeight / imgHeight;

  // 더 작은 비율을 사용하여 완전히 들어가도록
  const scale = Math.min(widthRatio, heightRatio);

  img.dataset.scale = scale.toString();
  updateImageTransform(img);

  // 줌 표시 업데이트
  const zoomValue = document.getElementById("zoomValue");
  if (zoomValue) zoomValue.textContent = Math.round(scale * 100) + "%";
}

// 이미지 컨트롤 이벤트 설정
function setupImageControls(img, viewer) {
  const controls = {
    // 모드 버튼들
    modeSelect: document.getElementById("modeSelect"),
    modePan: document.getElementById("modePan"),

    // 기존 컨트롤들
    zoomIn: document.getElementById("zoomIn"),
    zoomOut: document.getElementById("zoomOut"),
    zoomFit: document.getElementById("zoomFit"),
    zoom100: document.getElementById("zoom100"),
    zoomValue: document.getElementById("zoomValue"),
    brightnessSlider: document.getElementById("brightnessSlider"),
    brightnessValue: document.getElementById("brightnessValue"),
    contrastSlider: document.getElementById("contrastSlider"),
    contrastValue: document.getElementById("contrastValue"),
    resetAll: document.getElementById("resetAll"),
    measureDistance: document.getElementById("measureDistance"),
    measureAngle: document.getElementById("measureAngle"),
    measureArea: document.getElementById("measureArea"),
    clearMeasurements: document.getElementById("clearMeasurements"),
    measurementInfo: document.getElementById("measurementInfo"),
    selectedMeasurementInfo: document.getElementById("selectedMeasurementInfo"),
  };

  // 모드 컨트롤 설정
  setupModeControls(img, viewer, controls);

  // 줌 컨트롤 설정
  setupZoomControls(img, viewer, controls);

  // 조정 컨트롤 설정
  setupAdjustmentControls(img, controls);

  // 측정 도구 설정
  setupMeasurementTools(img, viewer, controls);

  // 마우스 휠 줌 설정
  setupWheelZoom(img, viewer, controls);
}

// 모드 컨트롤 설정 (새로 추가)
function setupModeControls(img, viewer, controls) {
  // 선택 모드
  controls.modeSelect.addEventListener("click", () => {
    setViewerMode(viewer, "select", controls);
  });

  // 패닝 모드
  controls.modePan.addEventListener("click", () => {
    setViewerMode(viewer, "pan", controls);
  });
}

// 뷰어 모드 설정 (새로 추가)
function setViewerMode(viewer, mode, controls) {
  const state = viewer.viewerState;
  const measurementState = viewer.measurementState;
  const img = viewer.querySelector("#dicomImage");

  // 기존 모드 정리
  state.mode = mode;
  measurementState.selectedMeasurement = null;
  measurementState.selectedPointIndex = -1;

  // 측정 모드 해제
  if (mode === "pan") {
    measurementState.mode = null;
    measurementState.isDrawing = false;
    measurementState.currentPoints = [];
  }

  // 커서 업데이트
  updateCursor(img, viewer);

  // 버튼 스타일 업데이트
  updateModeButtons(mode, controls);
  if (mode === "pan") {
    updateMeasurementButtons(null, controls);
  }

  // 정보 업데이트
  updateSelectedMeasurementInfo(controls);
  if (mode === "pan") {
    updateMeasurementInfo(null, controls);
  }

  // 화면 다시 그리기
  redrawMeasurements(viewer);
}

// 모드 버튼 스타일 업데이트 (새로 추가)
function updateModeButtons(activeMode, controls) {
  const buttons = [controls.modeSelect, controls.modePan];
  const modes = ["select", "pan"];

  buttons.forEach((btn, index) => {
    btn.classList.remove("mode-active", "bg-blue-500", "bg-gray-500");
    if (modes[index] === activeMode) {
      btn.classList.add("mode-active", "bg-blue-500");
    } else {
      btn.classList.add("bg-gray-500");
    }
  });
}

// 커서 업데이트 (수정됨)
function updateCursor(img, viewer) {
  const state = viewer.viewerState;
  const measurementState = viewer.measurementState;

  if (state.mode === "pan") {
    img.style.cursor = state.isDragging ? "grabbing" : "grab";
  } else if (state.mode === "select") {
    if (measurementState.mode) {
      img.style.cursor = "crosshair";
    } else {
      img.style.cursor = "default";
    }
  }
}

// 줌 컨트롤 설정
function setupZoomControls(img, viewer, controls) {
  // 줌 인
  controls.zoomIn.addEventListener("click", () => {
    let scale = parseFloat(img.dataset.scale);
    scale = Math.min(scale * 1.2, 5); // 최대 500%
    img.dataset.scale = scale.toString();
    updateImageTransform(img);
    controls.zoomValue.textContent = Math.round(scale * 100) + "%";
  });

  // 줌 아웃
  controls.zoomOut.addEventListener("click", () => {
    let scale = parseFloat(img.dataset.scale);
    scale = Math.max(scale / 1.2, 0.1); // 최소 10%
    img.dataset.scale = scale.toString();
    updateImageTransform(img);
    controls.zoomValue.textContent = Math.round(scale * 100) + "%";
  });

  // 맞춤
  controls.zoomFit.addEventListener("click", () => {
    fitImageToContainer(img, viewer);
  });

  // 100%
  controls.zoom100.addEventListener("click", () => {
    img.dataset.scale = "1";
    updateImageTransform(img);
    controls.zoomValue.textContent = "100%";
  });
}

// 조정 컨트롤 설정
function setupAdjustmentControls(img, controls) {
  // 밝기 조정
  controls.brightnessSlider.addEventListener("input", (e) => {
    const brightness = e.target.value;
    img.dataset.brightness = brightness;
    updateImageTransform(img);
    controls.brightnessValue.textContent = brightness + "%";
  });

  // 대비 조정
  controls.contrastSlider.addEventListener("input", (e) => {
    const contrast = e.target.value;
    img.dataset.contrast = contrast;
    updateImageTransform(img);
    controls.contrastValue.textContent = contrast + "%";
  });

  // 전체 초기화
  controls.resetAll.addEventListener("click", () => {
    img.dataset.scale = "1";
    img.dataset.brightness = "100";
    img.dataset.contrast = "100";

    controls.brightnessSlider.value = "100";
    controls.brightnessValue.textContent = "100%";
    controls.contrastSlider.value = "100";
    controls.contrastValue.textContent = "100%";

    updateImageTransform(img);
    controls.zoomValue.textContent = "100%";
  });
}

// 마우스 휠 줌 설정
function setupWheelZoom(img, viewer, controls) {
  viewer.addEventListener("wheel", (e) => {
    e.preventDefault();
    let scale = parseFloat(img.dataset.scale);

    if (e.deltaY < 0) {
      scale = Math.min(scale * 1.1, 5);
    } else {
      scale = Math.max(scale / 1.1, 0.1);
    }

    img.dataset.scale = scale.toString();
    updateImageTransform(img);
    controls.zoomValue.textContent = Math.round(scale * 100) + "%";
  });
}

// 이미지 이벤트 설정 (대폭 수정됨)
function setupImageEvents(img, viewer) {
  img.style.pointerEvents = "auto";
  img.style.position = "relative";
  img.style.left = "0px";
  img.style.top = "0px";

  // 마우스 다운 이벤트
  img.addEventListener("mousedown", (e) => {
    e.preventDefault();
    handleMouseDown(e, img, viewer);
  });

  // 마우스 무브 이벤트 (document에 등록)
  document.addEventListener("mousemove", (e) => {
    handleMouseMove(e, img, viewer);
  });

  // 마우스 업 이벤트 (document에 등록)
  document.addEventListener("mouseup", (e) => {
    handleMouseUp(e, img, viewer);
  });

  // 클릭 이벤트 (측정용)
  img.addEventListener("click", (e) => {
    handleImageClick(e, img, viewer);
  });

  // 우클릭 이벤트 (면적 측정 완료용)
  img.addEventListener("contextmenu", (e) => {
    handleContextMenu(e, img, viewer);
  });
}

// 마우스 다운 처리 (수정됨 - 선택된 측정만 편집 가능)
function handleMouseDown(e, img, viewer) {
  const state = viewer.viewerState;
  const measurementState = viewer.measurementState;

  if (state.mode === "pan") {
    // 패닝 모드: 이미지 드래그 시작
    state.isDragging = true;
    state.dragTarget = "image";
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.startLeft = parseInt(img.style.left) || 0;
    state.startTop = parseInt(img.style.top) || 0;
    updateCursor(img, viewer);
  } else if (state.mode === "select" && !measurementState.mode) {
    // 선택 모드에서 선택된 측정의 점만 편집 가능
    if (measurementState.selectedMeasurement) {
      const clickedPoint = getClickedMeasurementPoint(
        e,
        img,
        viewer,
        measurementState.selectedMeasurement
      );
      if (clickedPoint) {
        state.isDragging = true;
        state.dragTarget = clickedPoint;
        measurementState.selectedPointIndex = clickedPoint.pointIndex;

        // 편집 모드 표시
        updateSelectedMeasurementInfo(getCurrentControls(viewer));
        redrawMeasurements(viewer);
      }
    }
  }
}

// 마우스 무브 처리 (새로 추가)
function handleMouseMove(e, img, viewer) {
  const state = viewer.viewerState;

  if (!state.isDragging) return;

  if (state.dragTarget === "image") {
    // 이미지 패닝
    const deltaX = e.clientX - state.startX;
    const deltaY = e.clientY - state.startY;

    img.style.left = state.startLeft + deltaX + "px";
    img.style.top = state.startTop + deltaY + "px";

    redrawMeasurements(viewer);
  } else if (state.dragTarget && state.dragTarget.measurement) {
    // 측정점 드래그
    const point = getImagePoint(e, img, viewer);
    const measurement = state.dragTarget.measurement;
    const pointIndex = state.dragTarget.pointIndex;

    // 점 위치 업데이트
    measurement.points[pointIndex] = point;

    // 측정값 재계산
    recalculateMeasurement(measurement);

    redrawMeasurements(viewer);
    updateSelectedMeasurementInfo(getCurrentControls(viewer));
  }
}

// 마우스 업 처리 (수정됨 - 편집 완료 피드백 추가)
function handleMouseUp(e, img, viewer) {
  const state = viewer.viewerState;
  const measurementState = viewer.measurementState;

  if (state.isDragging && state.dragTarget && state.dragTarget.measurement) {
    // 편집이 완료된 경우
    measurementState.selectedPointIndex = -1;
    updateSelectedMeasurementInfo(getCurrentControls(viewer));
  }

  state.isDragging = false;
  state.dragTarget = null;
  updateCursor(img, viewer);
}

// 이미지 클릭 처리 (대폭 수정됨 - 모드별 분리)
function handleImageClick(e, img, viewer) {
  const state = viewer.viewerState;
  const measurementState = viewer.measurementState;

  // 드래그 중이었다면 클릭 이벤트 무시
  if (state.isDragging) return;

  if (state.mode === "select") {
    if (measurementState.mode) {
      // 측정 모드가 활성화된 경우: 새로운 측정 생성
      const point = getImagePoint(e, img, viewer);
      measurementState.currentPoints.push(point);
      handleMeasurementClick(viewer, getCurrentControls(viewer));
    } else {
      // 순수 선택 모드: 기존 측정 선택/해제만 가능
      const clickedMeasurement = getClickedMeasurement(e, img, viewer);
      if (clickedMeasurement) {
        // 같은 측정을 다시 클릭하면 선택 해제
        if (measurementState.selectedMeasurement === clickedMeasurement) {
          measurementState.selectedMeasurement = null;
          measurementState.selectedPointIndex = -1;
        } else {
          // 다른 측정 선택
          measurementState.selectedMeasurement = clickedMeasurement;
          measurementState.selectedPointIndex = -1;
        }
        updateSelectedMeasurementInfo(getCurrentControls(viewer));
        redrawMeasurements(viewer);
      } else {
        // 빈 공간 클릭 시 선택 해제
        if (measurementState.selectedMeasurement) {
          measurementState.selectedMeasurement = null;
          measurementState.selectedPointIndex = -1;
          updateSelectedMeasurementInfo(getCurrentControls(viewer));
          redrawMeasurements(viewer);
        }
      }
    }
  }
}

// 우클릭 처리 (수정됨)
function handleContextMenu(e, img, viewer) {
  const measurementState = viewer.measurementState;

  if (
    measurementState.mode === "area" &&
    measurementState.currentPoints.length >= 3
  ) {
    e.preventDefault();
    completeMeasurement(viewer, getCurrentControls(viewer));
  }
}

// 현재 컨트롤 객체 가져오기 (유틸리티 함수)
function getCurrentControls(viewer) {
  return {
    measureDistance: viewer.querySelector("#measureDistance"),
    measureAngle: viewer.querySelector("#measureAngle"),
    measureArea: viewer.querySelector("#measureArea"),
    clearMeasurements: viewer.querySelector("#clearMeasurements"),
    measurementInfo: viewer.querySelector("#measurementInfo"),
    selectedMeasurementInfo: viewer.querySelector("#selectedMeasurementInfo"),
    modeSelect: viewer.querySelector("#modeSelect"),
    modePan: viewer.querySelector("#modePan"),
  };
}

// 클릭된 측정점 확인 (수정됨 - 특정 측정만 확인)
function getClickedMeasurementPoint(
  event,
  img,
  viewer,
  specificMeasurement = null
) {
  const measurementState = viewer.measurementState;
  const point = getImagePoint(event, img, viewer);
  const clickRadius = 8; // 클릭 감지 반경

  // 특정 측정이 지정된 경우 해당 측정만 확인
  const measurementsToCheck = specificMeasurement
    ? [specificMeasurement]
    : measurementState.measurements;

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
        Math.pow(point.x - screenPoint.x, 2) +
          Math.pow(point.y - screenPoint.y, 2)
      );

      if (distance <= clickRadius) {
        return {
          measurement: measurement,
          pointIndex: i,
        };
      }
    }

    // 선/면적 영역도 확인 (선택된 측정인 경우만)
    if (specificMeasurement && measurement === specificMeasurement) {
      const screenPoints = measurement.points.map((p) =>
        getScreenCoordinates(p.relativeX, p.relativeY, img, viewer)
      );

      if (measurement.type === "distance" && screenPoints.length === 2) {
        if (isPointOnLine(point, screenPoints[0], screenPoints[1], 6)) {
          // 선 위를 클릭한 경우, 가장 가까운 점을 선택
          const dist1 = Math.sqrt(
            Math.pow(point.x - screenPoints[0].x, 2) +
              Math.pow(point.y - screenPoints[0].y, 2)
          );
          const dist2 = Math.sqrt(
            Math.pow(point.x - screenPoints[1].x, 2) +
              Math.pow(point.y - screenPoints[1].y, 2)
          );

          return {
            measurement: measurement,
            pointIndex: dist1 < dist2 ? 0 : 1,
          };
        }
      }
    }
  }

  return null;
}

// 클릭된 측정 객체 확인 (새로 추가)
function getClickedMeasurement(event, img, viewer) {
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
        Math.pow(point.x - screenPoint.x, 2) +
          Math.pow(point.y - screenPoint.y, 2)
      );
      if (distance <= clickRadius) {
        return measurement;
      }
    }

    // 선/면적 영역 확인 (간단한 방식)
    if (measurement.type === "distance" && screenPoints.length === 2) {
      if (isPointOnLine(point, screenPoints[0], screenPoints[1], clickRadius)) {
        return measurement;
      }
    }
  }

  return null;
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

// 측정값 재계산 (새로 추가)
function recalculateMeasurement(measurement) {
  switch (measurement.type) {
    case "distance":
      if (measurement.points.length >= 2) {
        measurement.value = calculateDistance(
          measurement.points[0],
          measurement.points[1]
        );
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

// 선택된 측정 정보 업데이트 (수정됨 - 모드 상태 고려)
function updateSelectedMeasurementInfo(controls) {
  const info = controls.selectedMeasurementInfo;
  if (!info) return;

  const viewer = info.closest("#imageViewer");
  const measurementState = viewer?.measurementState;
  const viewerState = viewer?.viewerState;

  if (measurementState?.selectedMeasurement) {
    const m = measurementState.selectedMeasurement;
    const typeText =
      m.type === "distance" ? "거리" : m.type === "angle" ? "각도" : "면적";

    // 편집 중인지 확인
    const isEditing =
      viewerState?.isDragging && measurementState.selectedPointIndex >= 0;

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

// 이미지 변환 업데이트
function updateImageTransform(img) {
  const scale = parseFloat(img.dataset.scale);
  const brightness = parseFloat(img.dataset.brightness);
  const contrast = parseFloat(img.dataset.contrast);

  const originalWidth = parseInt(img.dataset.originalWidth);
  const originalHeight = parseInt(img.dataset.originalHeight);

  img.style.width = originalWidth * scale + "px";
  img.style.height = originalHeight * scale + "px";
  img.style.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  img.style.maxWidth = "none";
  img.style.maxHeight = "none";

  // 줌 변경 시 측정 오버레이 업데이트
  const viewer = img.closest("#imageViewer");
  if (viewer) {
    redrawMeasurements(viewer);
  }
}

// 측정 캔버스 생성
function createMeasurementCanvas(viewer) {
  const existingCanvas = viewer.querySelector(".measurement-canvas");
  if (existingCanvas) existingCanvas.remove();

  const canvas = document.createElement("canvas");
  canvas.className =
    "measurement-canvas absolute top-0 left-0 pointer-events-none z-20";
  canvas.style.width = "100%";
  canvas.style.height = "100%";

  // 캔버스 크기를 뷰어 크기에 맞춤
  canvas.width = viewer.clientWidth;
  canvas.height = viewer.clientHeight;

  viewer.appendChild(canvas);

  // 윈도우 리사이즈 시 캔버스 크기 조정
  window.addEventListener("resize", () => {
    canvas.width = viewer.clientWidth;
    canvas.height = viewer.clientHeight;
    redrawMeasurements(viewer);
  });
}

// 측정 도구 설정
function setupMeasurementTools(img, viewer, controls) {
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

  // 측정 지우기
  controls.clearMeasurements.addEventListener("click", () => {
    clearAllMeasurements(viewer, controls);
  });
}

// 측정 모드 설정 (수정됨 - 선택 모드와 분리)
function setMeasurementMode(viewer, mode, controls) {
  const state = viewer.measurementState;
  const viewerState = viewer.viewerState;
  const img = viewer.querySelector("#dicomImage");

  // 선택 모드로 자동 전환 (하지만 측정 모드가 우선)
  if (viewerState.mode !== "select") {
    setViewerMode(viewer, "select", controls);
  }

  // 기존 선택 해제
  state.selectedMeasurement = null;
  state.selectedPointIndex = -1;

  // 기존 측정 중단
  state.isDrawing = false;
  state.currentPoints = [];

  // 새 모드 설정
  state.mode = mode;

  // 커서 변경
  updateCursor(img, viewer);

  // 버튼 스타일 업데이트
  updateMeasurementButtons(mode, controls);

  // 안내 메시지 업데이트
  updateMeasurementInfo(mode, controls);
  updateSelectedMeasurementInfo(controls);

  // 화면 다시 그리기
  redrawMeasurements(viewer);
}

// 측정 버튼 스타일 업데이트
function updateMeasurementButtons(activeMode, controls) {
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

// 측정 정보 업데이트 (수정됨 - 상태별 메시지 개선)
function updateMeasurementInfo(mode, controls) {
  const messages = {
    distance: "거리 측정 모드: 두 점을 클릭하세요",
    angle: "각도 측정 모드: 세 점을 순서대로 클릭하세요 (점1-꼭짓점-점2)",
    area: "면적 측정 모드: 영역의 경계를 클릭하세요 (우클릭으로 완료)",
  };

  if (mode) {
    controls.measurementInfo.innerHTML = `<span class="text-blue-600 font-medium">${messages[mode]}</span>`;
  } else {
    controls.measurementInfo.textContent =
      "측정 도구를 선택하거나 기존 측정을 클릭하세요";
  }
}

// 이미지 상의 좌표 계산
function getImagePoint(event, img, viewer) {
  const rect = img.getBoundingClientRect();
  const viewerRect = viewer.getBoundingClientRect();

  // 이미지 내부의 상대 좌표 (0~1 범위)
  const relativeX = (event.clientX - rect.left) / rect.width;
  const relativeY = (event.clientY - rect.top) / rect.height;

  return {
    // 뷰어 좌표 (패닝 시 변경됨)
    x: event.clientX - viewerRect.left,
    y: event.clientY - viewerRect.top,
    // 이미지 원본 좌표 (패닝과 무관)
    imageX: relativeX * img.naturalWidth,
    imageY: relativeY * img.naturalHeight,
    // 이미지 내 상대 좌표 (0~1, 패닝과 무관)
    relativeX: relativeX,
    relativeY: relativeY,
  };
}

// 측정 클릭 처리
function handleMeasurementClick(viewer, controls) {
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
      redrawMeasurements(viewer);
      break;
  }
}

// 측정 완료 (수정됨 - 완료 후 측정 모드 해제)
function completeMeasurement(viewer, controls) {
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
  redrawMeasurements(viewer);
  updateMeasurementInfo(null, controls);
  updateSelectedMeasurementInfo(controls);

  // 결과 표시 (임시)
  showMeasurementResult(measurement, controls, completedType);

  // 커서 업데이트
  const img = viewer.querySelector("#dicomImage");
  updateCursor(img, viewer);
}

// 거리 계산
function calculateDistance(p1, p2) {
  const dx = p2.imageX - p1.imageX;
  const dy = p2.imageY - p1.imageY;
  return Math.sqrt(dx * dx + dy * dy);
}

// 각도 계산
function calculateAngle(p1, vertex, p2) {
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
function calculateArea(points) {
  if (points.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].imageX * points[j].imageY;
    area -= points[j].imageX * points[i].imageY;
  }
  return Math.abs(area) / 2;
}

// 측정 결과 표시 (수정됨 - 매개변수 추가)
function showMeasurementResult(measurement, controls, completedType) {
  const info = controls.measurementInfo;
  const typeText =
    completedType === "distance"
      ? "거리"
      : completedType === "angle"
      ? "각도"
      : "면적";

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

// 측정 결과 다시 그리기 (수정됨 - 선택된 측정 강조)
function redrawMeasurements(viewer) {
  const canvas = viewer.querySelector(".measurement-canvas");
  const img = viewer.querySelector("#dicomImage");
  if (!canvas || !img) return;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const state = viewer.measurementState;

  // 저장된 측정 결과 그리기
  state.measurements.forEach((measurement) => {
    const isSelected = measurement === state.selectedMeasurement;
    drawMeasurement(ctx, measurement, img, viewer, isSelected);
  });

  // 현재 그리는 중인 측정 그리기
  if (state.currentPoints.length > 0) {
    drawCurrentMeasurement(ctx, state, img, viewer);
  }
}

// 상대 좌표를 현재 화면 좌표로 변환
function getScreenCoordinates(relativeX, relativeY, img, viewer) {
  const imgRect = img.getBoundingClientRect();
  const viewerRect = viewer.getBoundingClientRect();

  return {
    x: imgRect.left - viewerRect.left + relativeX * imgRect.width,
    y: imgRect.top - viewerRect.top + relativeY * imgRect.height,
  };
}

// 측정 그리기 (수정됨 - 편집 중인 점 강조)
function drawMeasurement(ctx, measurement, img, viewer, isSelected = false) {
  // 선택된 측정은 다른 색상으로 표시
  const strokeColor = isSelected ? "#ff0000" : "#ff6b6b";
  const fillColor = isSelected ? "#ff0000" : "#ff6b6b";

  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;
  ctx.lineWidth = isSelected ? 3 : 2;

  // 편집 중인 점 확인
  const measurementState = viewer.measurementState;
  const editingPointIndex =
    isSelected && measurementState.selectedPointIndex >= 0
      ? measurementState.selectedPointIndex
      : -1;

  // 상대 좌표를 현재 화면 좌표로 변환
  const screenPoints = measurement.points.map((point) =>
    getScreenCoordinates(point.relativeX, point.relativeY, img, viewer)
  );

  switch (measurement.type) {
    case "distance":
      // 선 그리기
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      ctx.lineTo(screenPoints[1].x, screenPoints[1].y);
      ctx.stroke();

      // 점 그리기 (편집 중인 점은 더 크게)
      screenPoints.forEach((point, index) => {
        const isEditingPoint = index === editingPointIndex;
        const pointRadius = isEditingPoint ? 8 : isSelected ? 6 : 4;

        ctx.fillStyle = isEditingPoint ? "#ffa500" : fillColor; // 편집 중인 점은 오렌지색
        ctx.beginPath();
        ctx.arc(point.x, point.y, pointRadius, 0, 2 * Math.PI);
        ctx.fill();

        // 편집 중인 점에 테두리 추가
        if (isEditingPoint) {
          ctx.strokeStyle = "#ff0000";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.strokeStyle = strokeColor; // 원래 색상 복원
          ctx.lineWidth = isSelected ? 3 : 2;
        }
      });

      // 라벨 그리기
      const midX = (screenPoints[0].x + screenPoints[1].x) / 2;
      const midY = (screenPoints[0].y + screenPoints[1].y) / 2;
      drawLabel(ctx, measurement.label, midX, midY, isSelected);
      break;

    case "angle":
      // 각도 선들 그리기 (점1->꼭짓점, 점2->꼭짓점)
      ctx.beginPath();
      ctx.moveTo(screenPoints[1].x, screenPoints[1].y); // 꼭짓점에서
      ctx.lineTo(screenPoints[0].x, screenPoints[0].y); // 첫 번째 점으로
      ctx.moveTo(screenPoints[1].x, screenPoints[1].y); // 꼭짓점에서
      ctx.lineTo(screenPoints[2].x, screenPoints[2].y); // 세 번째 점으로
      ctx.stroke();

      // 점들 그리기
      screenPoints.forEach((point, index) => {
        const isEditingPoint = index === editingPointIndex;
        const isVertex = index === 1; // 꼭짓점
        const pointRadius = isEditingPoint ? 8 : isSelected ? 6 : 4;

        let pointColor;
        if (isEditingPoint) {
          pointColor = "#ffa500"; // 편집 중인 점은 오렌지색
        } else if (isVertex) {
          pointColor = "#ff0000"; // 꼭짓점은 빨간색
        } else {
          pointColor = fillColor;
        }

        ctx.fillStyle = pointColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, pointRadius, 0, 2 * Math.PI);
        ctx.fill();

        // 편집 중인 점에 테두리 추가
        if (isEditingPoint) {
          ctx.strokeStyle = "#ff0000";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.strokeStyle = strokeColor; // 원래 색상 복원
          ctx.lineWidth = isSelected ? 3 : 2;
        }
      });

      // 각도 호 그리기
      const arcRadius = isSelected ? 35 : 30;
      const angle1 = Math.atan2(
        screenPoints[0].y - screenPoints[1].y,
        screenPoints[0].x - screenPoints[1].x
      );
      const angle2 = Math.atan2(
        screenPoints[2].y - screenPoints[1].y,
        screenPoints[2].x - screenPoints[1].x
      );

      ctx.strokeStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(screenPoints[1].x, screenPoints[1].y, arcRadius, angle1, angle2);
      ctx.stroke();

      // 라벨 그리기
      drawLabel(
        ctx,
        measurement.label,
        screenPoints[1].x + 40,
        screenPoints[1].y - 20,
        isSelected
      );
      break;

    case "area":
      // 다각형 그리기
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i++) {
        ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      // 반투명 채우기
      ctx.fillStyle = isSelected
        ? "rgba(255, 0, 0, 0.3)"
        : "rgba(255, 107, 107, 0.2)";
      ctx.fill();

      // 점들 그리기
      screenPoints.forEach((point, index) => {
        const isEditingPoint = index === editingPointIndex;
        const pointRadius = isEditingPoint ? 8 : isSelected ? 6 : 4;

        ctx.fillStyle = isEditingPoint ? "#ffa500" : fillColor; // 편집 중인 점은 오렌지색
        ctx.beginPath();
        ctx.arc(point.x, point.y, pointRadius, 0, 2 * Math.PI);
        ctx.fill();

        // 편집 중인 점에 테두리 추가
        if (isEditingPoint) {
          ctx.strokeStyle = "#ff0000";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.strokeStyle = strokeColor; // 원래 색상 복원
          ctx.lineWidth = isSelected ? 3 : 2;
        }
      });

      // 중심점에 라벨 그리기
      const centerX =
        screenPoints.reduce((sum, p) => sum + p.x, 0) / screenPoints.length;
      const centerY =
        screenPoints.reduce((sum, p) => sum + p.y, 0) / screenPoints.length;
      drawLabel(ctx, measurement.label, centerX, centerY, isSelected);
      break;
  }
}

// 현재 그리는 중인 측정 그리기
function drawCurrentMeasurement(ctx, state, img, viewer) {
  ctx.strokeStyle = "#4dabf7";
  ctx.fillStyle = "#4dabf7";
  ctx.lineWidth = 2;

  if (state.currentPoints.length === 0) return;

  // 상대 좌표를 현재 화면 좌표로 변환
  const screenPoints = state.currentPoints.map((point) =>
    getScreenCoordinates(point.relativeX, point.relativeY, img, viewer)
  );

  // 점들 그리기
  screenPoints.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
    ctx.fill();
  });

  // 선 그리기
  if (screenPoints.length > 1) {
    ctx.beginPath();
    ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i++) {
      ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    if (state.mode === "area" && screenPoints.length > 2) {
      ctx.closePath();
    }
    ctx.stroke();
  }
}

// 라벨 그리기 (수정됨 - 선택 상태 추가)
function drawLabel(ctx, text, x, y, isSelected = false) {
  const fontSize = isSelected ? 14 : 12;
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = "white";
  ctx.strokeStyle = isSelected ? "#ff0000" : "black";
  ctx.lineWidth = isSelected ? 4 : 3;

  // 배경 그리기
  const metrics = ctx.measureText(text);
  const padding = isSelected ? 6 : 4;
  const height = fontSize + 4;

  ctx.fillRect(
    x - metrics.width / 2 - padding,
    y - height - padding,
    metrics.width + 2 * padding,
    height + 2 * padding
  );
  ctx.strokeRect(
    x - metrics.width / 2 - padding,
    y - height - padding,
    metrics.width + 2 * padding,
    height + 2 * padding
  );

  // 텍스트 그리기
  ctx.fillStyle = isSelected ? "#ff0000" : "black";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

// 모든 측정 지우기 (수정됨 - 상태 완전 초기화)
function clearAllMeasurements(viewer, controls) {
  const state = viewer.measurementState;
  const viewerState = viewer.viewerState;
  const img = viewer.querySelector("#dicomImage");

  state.measurements = [];
  state.currentPoints = [];
  state.selectedMeasurement = null;
  state.selectedPointIndex = -1;
  state.mode = null; // 측정 모드도 해제

  // 커서 복원
  updateCursor(img, viewer);

  redrawMeasurements(viewer);
  updateMeasurementButtons(null, controls);
  updateMeasurementInfo(null, controls);
  updateSelectedMeasurementInfo(controls);
}
