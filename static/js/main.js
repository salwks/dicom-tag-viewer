// main.js - 메인 애플리케이션 초기화

import { initUploader } from './uploader.js';
import { showChart, showTable, showViewer } from './uiController.js';

document.addEventListener('DOMContentLoaded', () => {
  // 파일 업로더 초기화
  initUploader();
  
  // 탭 버튼 이벤트 리스너 등록
  document.getElementById('btnChart').addEventListener('click', showChart);
  document.getElementById('btnTable').addEventListener('click', showTable);
  document.getElementById('btnViewer').addEventListener('click', showViewer);
});