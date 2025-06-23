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

  // 측정 상태 초기화
  viewer.measurementState = {
    mode: null, // 'distance', 'angle', 'area', null
    isDrawing: false,
    currentPoints: [],
    measurements: [],
  };

  // 초기 크기 설정 (fit to container)
  fitImageToContainer(img, viewer);

  // 드래그 기능 설정
  setupImageDrag(img, viewer);

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
  };

  // 줌 컨트롤 설정
  setupZoomControls(img, viewer, controls);

  // 조정 컨트롤 설정
  setupAdjustmentControls(img, controls);

  // 측정 도구 설정
  setupMeasurementTools(img, viewer, controls);

  // 마우스 휠 줌 설정
  setupWheelZoom(img, viewer, controls);
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

// 이미지 드래그 설정
function setupImageDrag(img, viewer) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  img.style.cursor = "grab";
  img.style.position = "relative";
  img.style.left = "0px";
  img.style.top = "0px";

  img.addEventListener("mousedown", (e) => {
    // 측정 모드일 때는 드래그 비활성화
    if (viewer.measurementState && viewer.measurementState.mode) {
      return;
    }

    e.preventDefault();
    isDragging = true;
    img.style.cursor = "grabbing";

    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseInt(img.style.left) || 0;
    startTop = parseInt(img.style.top) || 0;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    img.style.left = startLeft + deltaX + "px";
    img.style.top = startTop + deltaY + "px";

    // 측정 오버레이 업데이트
    redrawMeasurements(viewer);
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    img.style.cursor = viewer.measurementState?.mode ? "crosshair" : "grab";
  });
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

  // 이미지 클릭 이벤트 설정
  setupMeasurementEvents(img, viewer, controls);
}

// 측정 모드 설정
function setMeasurementMode(viewer, mode, controls) {
  const state = viewer.measurementState;
  const img = viewer.querySelector("#dicomImage");

  // 기존 측정 중단
  state.isDrawing = false;
  state.currentPoints = [];

  // 새 모드 설정
  state.mode = mode;

  // 커서 변경
  img.style.cursor = mode ? "crosshair" : "grab";

  // 버튼 스타일 업데이트
  updateMeasurementButtons(mode, controls);

  // 안내 메시지 업데이트
  updateMeasurementInfo(mode, controls);
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

// 측정 정보 업데이트
function updateMeasurementInfo(mode, controls) {
  const messages = {
    distance: "거리 측정: 두 점을 클릭하세요",
    angle: "각도 측정: 세 점을 순서대로 클릭하세요 (점1-꼭짓점-점2)",
    area: "면적 측정: 영역의 경계를 클릭하세요 (우클릭으로 완료)",
  };

  controls.measurementInfo.textContent =
    messages[mode] || "측정 도구를 선택하세요";
}

// 측정 이벤트 설정
function setupMeasurementEvents(img, viewer, controls) {
  img.style.pointerEvents = "auto";

  img.addEventListener("click", (e) => {
    const state = viewer.measurementState;
    if (!state.mode) return;

    e.preventDefault();

    const point = getImagePoint(e, img, viewer);
    state.currentPoints.push(point);

    handleMeasurementClick(viewer, controls);
  });

  img.addEventListener("contextmenu", (e) => {
    const state = viewer.measurementState;
    if (state.mode === "area" && state.currentPoints.length >= 3) {
      e.preventDefault();
      completeMeasurement(viewer, controls);
    }
  });
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

// 측정 완료
function completeMeasurement(viewer, controls) {
  const state = viewer.measurementState;
  const points = [...state.currentPoints];

  let measurement = {
    type: state.mode,
    points: points,
    id: Date.now(),
  };

  // 계산 수행
  switch (state.mode) {
    case "distance":
      measurement.value = calculateDistance(points[0], points[1]);
      measurement.label = `${measurement.value.toFixed(1)} px`;
      break;
    case "angle":
      measurement.value = calculateAngle(points[0], points[1], points[2]);
      measurement.label = `${measurement.value.toFixed(1)}°`;
      break;
    case "area":
      measurement.value = calculateArea(points);
      measurement.label = `${measurement.value.toFixed(1)} px²`;
      break;
  }

  // 측정 결과 저장
  state.measurements.push(measurement);

  // 상태 초기화
  state.currentPoints = [];

  // 화면 업데이트
  redrawMeasurements(viewer);
  updateMeasurementInfo(state.mode, controls);

  // 결과 표시
  showMeasurementResult(measurement, controls);
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

// 측정 결과 표시
function showMeasurementResult(measurement, controls) {
  const info = controls.measurementInfo;
  info.innerHTML = `
    <div class="bg-blue-100 p-2 rounded text-center">
      <strong>${
        measurement.type === "distance"
          ? "거리"
          : measurement.type === "angle"
          ? "각도"
          : "면적"
      }: ${measurement.label}</strong>
    </div>
  `;

  setTimeout(() => {
    updateMeasurementInfo(null, controls);
  }, 3000);
}

// 측정 결과 다시 그리기
function redrawMeasurements(viewer) {
  const canvas = viewer.querySelector(".measurement-canvas");
  const img = viewer.querySelector("#dicomImage");
  if (!canvas || !img) return;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const state = viewer.measurementState;

  // 저장된 측정 결과 그리기
  state.measurements.forEach((measurement) => {
    drawMeasurement(ctx, measurement, img, viewer);
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

// 측정 그리기
function drawMeasurement(ctx, measurement, img, viewer) {
  ctx.strokeStyle = "#ff6b6b";
  ctx.fillStyle = "#ff6b6b";
  ctx.lineWidth = 2;

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

      // 점 그리기
      screenPoints.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // 라벨 그리기
      const midX = (screenPoints[0].x + screenPoints[1].x) / 2;
      const midY = (screenPoints[0].y + screenPoints[1].y) / 2;
      drawLabel(ctx, measurement.label, midX, midY);
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
        ctx.fillStyle = index === 1 ? "#ff0000" : "#ff6b6b"; // 꼭짓점(두 번째 점)은 빨간색
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // 각도 호 그리기
      const arcRadius = 30;
      const angle1 = Math.atan2(
        screenPoints[0].y - screenPoints[1].y,
        screenPoints[0].x - screenPoints[1].x
      );
      const angle2 = Math.atan2(
        screenPoints[2].y - screenPoints[1].y,
        screenPoints[2].x - screenPoints[1].x
      );

      ctx.beginPath();
      ctx.arc(screenPoints[1].x, screenPoints[1].y, arcRadius, angle1, angle2);
      ctx.stroke();

      // 라벨 그리기
      drawLabel(
        ctx,
        measurement.label,
        screenPoints[1].x + 40,
        screenPoints[1].y - 20
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
      ctx.fillStyle = "rgba(255, 107, 107, 0.2)";
      ctx.fill();

      // 점들 그리기
      ctx.fillStyle = "#ff6b6b";
      screenPoints.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });

      // 중심점에 라벨 그리기
      const centerX =
        screenPoints.reduce((sum, p) => sum + p.x, 0) / screenPoints.length;
      const centerY =
        screenPoints.reduce((sum, p) => sum + p.y, 0) / screenPoints.length;
      drawLabel(ctx, measurement.label, centerX, centerY);
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

// 라벨 그리기
function drawLabel(ctx, text, x, y) {
  ctx.font = "12px Arial";
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 3;

  // 배경 그리기
  const metrics = ctx.measureText(text);
  const padding = 4;
  ctx.fillRect(
    x - metrics.width / 2 - padding,
    y - 12 - padding,
    metrics.width + 2 * padding,
    16 + 2 * padding
  );
  ctx.strokeRect(
    x - metrics.width / 2 - padding,
    y - 12 - padding,
    metrics.width + 2 * padding,
    16 + 2 * padding
  );

  // 텍스트 그리기
  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

// 모든 측정 지우기
function clearAllMeasurements(viewer, controls) {
  const state = viewer.measurementState;
  const img = viewer.querySelector("#dicomImage");

  state.measurements = [];
  state.currentPoints = [];
  state.mode = null;

  // 커서 복원
  img.style.cursor = "grab";

  redrawMeasurements(viewer);
  updateMeasurementButtons(null, controls);
  updateMeasurementInfo(null, controls);
}
