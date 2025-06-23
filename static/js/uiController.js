// uiController.js - 메인 UI 컨트롤러 (각 탭 기능을 import하여 사용)

import { showChart } from './chartController.js';
import { showTable } from './tableController.js';
import { showViewer } from './viewerController.js';

// 각 탭 함수를 export (기존 코드와의 호환성을 위해)
export { showChart, showTable, showViewer };