// utils.js - 공통 유틸리티 함수들

// 이미지 상의 좌표 계산
export function getImagePoint(event, img, viewer) {
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

// 상대 좌표를 현재 화면 좌표로 변환
export function getScreenCoordinates(relativeX, relativeY, img, viewer) {
  const imgRect = img.getBoundingClientRect();
  const viewerRect = viewer.getBoundingClientRect();

  return {
    x: imgRect.left - viewerRect.left + relativeX * imgRect.width,
    y: imgRect.top - viewerRect.top + relativeY * imgRect.height,
  };
}

// 클립보드 복사 (기존 utils.js에서 가져옴)
export function copyToClipboard(value) {
  if (!navigator.clipboard) {
    alert("복사를 지원하지 않는 브라우저입니다.");
    return;
  }
  navigator.clipboard.writeText(value)
    .then(() => alert("UID가 클립보드에 복사되었습니다."))
    .catch(err => {
      console.error("복사 실패:", err);
      alert("복사에 실패했습니다.");
    });
}

// 텍스트 측정용 임시 요소 생성 (table.js에서 가져옴)
export function createTextMeasurer(referenceElement) {
  const measurer = document.createElement('span');
  measurer.style.visibility = 'hidden';
  measurer.style.position = 'absolute';
  measurer.style.whiteSpace = 'nowrap';
  measurer.style.fontSize = window.getComputedStyle(referenceElement).fontSize;
  measurer.style.fontFamily = window.getComputedStyle(referenceElement).fontFamily;
  document.body.appendChild(measurer);
  return measurer;
}

// 이진 탐색으로 최적 텍스트 길이 찾기 (table.js에서 가져옴)
export function findOptimalTextLength(text, maxWidth, measurer) {
  let left = 0;
  let right = text.length;
  let bestLength = 0;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const testText = text.substring(0, mid) + '...';
    
    measurer.textContent = testText;
    const testWidth = measurer.offsetWidth;

    if (testWidth <= maxWidth) {
      bestLength = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return bestLength;
}