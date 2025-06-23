// adjustmentController.js - 이미지 조정 관련 기능들

// 조정 컨트롤 설정
export function setupAdjustmentControls(img, controls) {
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
    resetImageAdjustments(img, controls);
  });
}

// 줌 컨트롤 설정
export function setupZoomControls(img, viewer, controls) {
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
    controls.zoomValue.textContent = Math.round(parseFloat(img.dataset.scale) * 100) + "%";
  });

  // 100%
  controls.zoom100.addEventListener("click", () => {
    img.dataset.scale = "1";
    updateImageTransform(img);
    controls.zoomValue.textContent = "100%";
  });
}

// 마우스 휠 줌 설정
export function setupWheelZoom(img, viewer, controls) {
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

// 컨테이너에 맞춤
export function fitImageToContainer(img, viewer) {
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

  return scale;
}

// 이미지 변환 업데이트
export function updateImageTransform(img) {
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
  if (viewer && window.redrawMeasurements) {
    window.redrawMeasurements(viewer);
  }
}

// 이미지 조정 초기화
export function resetImageAdjustments(img, controls) {
  img.dataset.scale = "1";
  img.dataset.brightness = "100";
  img.dataset.contrast = "100";

  controls.brightnessSlider.value = "100";
  controls.brightnessValue.textContent = "100%";
  controls.contrastSlider.value = "100";
  controls.contrastValue.textContent = "100%";

  updateImageTransform(img);
  controls.zoomValue.textContent = "100%";
}