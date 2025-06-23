// tableController.js - DICOM 태그 테이블 관리

export function showTable() {
  // 탭 전환
  document.getElementById('dicomTree').classList.add('hidden');
  document.getElementById('tagTableContainer').classList.remove('hidden');
  document.getElementById('imageViewer').classList.add('hidden');

  const data = window.dicomData;
  if (!data) return alert("데이터가 없습니다.");

  const tbody = document.querySelector('#tagTable tbody');
  tbody.innerHTML = '';

  // DICOM 데이터를 평면화하여 테이블 행 생성
  function flatten(node) {
    if (node.children) {
      node.children.forEach(flatten);
    } else if (node.tag_id) {
      const rawValue = node.value_field;

      // 값을 문자열로 변환
      let valueStr = '';
      if (typeof rawValue === 'string') {
        valueStr = rawValue;
      } else if (rawValue === null || rawValue === undefined) {
        valueStr = '';
      } else {
        valueStr = JSON.stringify(rawValue);
      }

      // Pixel Data 체크
      const isPixelData = /\(7fe0,0010\)/i.test(node.tag_id);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-2 py-1 text-xs">${node.tag_id}</td>
        <td class="border px-2 py-1 text-xs">${node.description}</td>
        <td class="border px-2 py-1 text-xs">${node.vr}</td>
        <td class="border px-2 py-1 text-xs">${node.vm}</td>
        <td class="border px-2 py-1 text-xs">${node.value_length}</td>
        <td class="border px-2 py-1 text-xs value-cell">
          <div class="value-container flex items-center">
            <span class="value-text flex-1"></span>
            <button class="copy-btn ml-2 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 hidden">복사</button>
          </div>
        </td>
      `;

      const valueText = tr.querySelector('.value-text');
      const copyBtn = tr.querySelector('.copy-btn');

      // 텍스트 처리 및 표시
      processValueText(valueText, copyBtn, valueStr, isPixelData);

      tbody.appendChild(tr);
    }
  }

  flatten(data);

  // 테이블 렌더링 후 동적 조정
  setTimeout(() => {
    applyDynamicTruncation();
  }, 100);
}

// 값 텍스트 처리 함수
function processValueText(valueText, copyBtn, valueStr, isPixelData) {
  if (isPixelData) {
    // Pixel Data 특별 처리
    valueText.textContent = `[Pixel Data: ${valueStr.length.toLocaleString()}자]`;
    valueText.title = `Pixel Data (${valueStr.length}자)`;
    copyBtn.classList.remove('hidden');
    
    copyBtn.addEventListener('click', () => {
      if (confirm(`Pixel Data는 ${valueStr.length.toLocaleString()}자입니다. 정말 복사하시겠습니까?`)) {
        copyToClipboard(valueStr, copyBtn);
      }
    });
  } else if (valueStr.length > 10000) {
    // 매우 긴 텍스트 처리
    valueText.textContent = `${valueStr.substring(0, 100)}... [총 ${valueStr.length.toLocaleString()}자]`;
    valueText.title = valueStr;
    copyBtn.classList.remove('hidden');
    
    copyBtn.addEventListener('click', () => {
      if (confirm(`이 데이터는 ${valueStr.length.toLocaleString()}자입니다. 정말 복사하시겠습니까?`)) {
        copyToClipboard(valueStr, copyBtn);
      }
    });
  } else if (valueStr.length > 50) {
    // 일반적인 긴 텍스트 - 고정 길이로 자르기
    valueText.textContent = valueStr.substring(0, 50) + '...';
    valueText.title = valueStr;
    copyBtn.classList.remove('hidden');
    
    copyBtn.addEventListener('click', () => {
      copyToClipboard(valueStr, copyBtn);
    });
  } else {
    // 짧은 텍스트
    valueText.textContent = valueStr;
    valueText.title = valueStr;
    copyBtn.classList.add('hidden');
  }
}

// 동적 말줄임 적용
function applyDynamicTruncation() {
  const valueRows = document.querySelectorAll('#tagTable tbody tr');
  
  valueRows.forEach(row => {
    const valueCell = row.querySelector('.value-cell');
    const valueText = row.querySelector('.value-text');
    const copyBtn = row.querySelector('.copy-btn');
    
    if (!valueCell || !valueText || !copyBtn) return;

    const originalText = valueText.title || valueText.textContent;
    
    // 이미 처리된 특수 케이스들은 건너뛰기
    if (originalText.includes('[Pixel Data:') || 
        originalText.includes('총') && originalText.includes('자]') ||
        originalText.length <= 50) {
      return;
    }

    // 현재 셀의 실제 사용 가능한 너비 계산
    const cellWidth = valueCell.offsetWidth;
    const cellPadding = 16; // px-2
    const btnWidth = copyBtn.offsetWidth || 50;
    const gap = 8; // ml-2
    const availableWidth = cellWidth - cellPadding - btnWidth - gap - 10; // 여유공간

    if (availableWidth <= 0) return;

    // 텍스트 너비 측정을 위한 임시 요소 생성
    const measurer = createTextMeasurer(valueText);

    // 원본 텍스트가 셀을 넘치는지 확인
    measurer.textContent = originalText;
    const originalWidth = measurer.offsetWidth;

    if (originalWidth > availableWidth) {
      // 이진 탐색으로 적절한 길이 찾기
      const bestLength = findOptimalTextLength(originalText, availableWidth, measurer);

      // 말줄임 적용
      if (bestLength > 0) {
        valueText.textContent = originalText.substring(0, bestLength) + '...';
        copyBtn.classList.remove('hidden');
      } else {
        valueText.textContent = '...';
        copyBtn.classList.remove('hidden');
      }
    } else {
      // 말줄임 불필요
      valueText.textContent = originalText;
      copyBtn.classList.add('hidden');
    }

    document.body.removeChild(measurer);
  });
}

// 텍스트 측정용 임시 요소 생성
function createTextMeasurer(referenceElement) {
  const measurer = document.createElement('span');
  measurer.style.visibility = 'hidden';
  measurer.style.position = 'absolute';
  measurer.style.whiteSpace = 'nowrap';
  measurer.style.fontSize = window.getComputedStyle(referenceElement).fontSize;
  measurer.style.fontFamily = window.getComputedStyle(referenceElement).fontFamily;
  document.body.appendChild(measurer);
  return measurer;
}

// 이진 탐색으로 최적 텍스트 길이 찾기
function findOptimalTextLength(text, maxWidth, measurer) {
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

// 클립보드 복사 함수
function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text)
    .then(() => {
      const originalText = button.textContent;
      button.textContent = '복사완료';
      button.classList.add('bg-green-500');
      button.classList.remove('bg-blue-500');
      
      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove('bg-green-500');
        button.classList.add('bg-blue-500');
      }, 1500);
    })
    .catch(err => {
      console.error('복사 실패:', err);
      alert('복사에 실패했습니다.');
    });
}