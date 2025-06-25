/**
 * 중앙화된 상태 관리 시스템
 * 모든 앱 상태를 관리하고 컴포넌트 간 통신을 담당
 */

class AppStateManager {
  constructor() {
    this.state = {
      // 파일 관련 상태
      uploadedFile: null,
      dicomData: null,

      // UI 상태
      currentView: "chart", // 'chart', 'table', 'viewer'
      isLoading: false,
      error: null,

      // 뷰어 상태
      viewer: {
        mode: "select", // 'select', 'pan'
        isDragging: false,
        dragTarget: null,

        // 이미지 변환 상태
        scale: 1,
        brightness: 100,
        contrast: 100,
        position: { x: 0, y: 0 },

        // 측정 상태
        measurements: [],
        selectedMeasurement: null,
        measurementMode: null, // 'distance', 'angle', 'area', null
        currentPoints: [],

        // 주석 상태
        annotations: {
          shapes: [],
          drawings: [],
          selectedShape: null,
          selectedDrawing: null,
          shapeMode: null,
          drawingMode: null,
          strokeWidth: 2,
          strokeColor: "#ff0000",
        },
      },
    };

    this.subscribers = new Map();
    this.eventListeners = new Map();
  }

  /**
   * 상태 구독
   * @param {string} path - 구독할 상태 경로 (예: 'viewer.measurements')
   * @param {Function} callback - 상태 변경 시 호출될 콜백
   * @returns {Function} 구독 해제 함수
   */
  subscribe(path, callback) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    this.subscribers.get(path).add(callback);

    // 구독 해제 함수 반환
    return () => {
      const callbacks = this.subscribers.get(path);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  /**
   * 상태 업데이트
   * @param {string} path - 업데이트할 상태 경로
   * @param {*} value - 새로운 값
   */
  setState(path, value) {
    const pathArray = path.split(".");
    let target = this.state;

    // 경로의 마지막 부분을 제외하고 네비게이션
    for (let i = 0; i < pathArray.length - 1; i++) {
      if (!target[pathArray[i]]) {
        target[pathArray[i]] = {};
      }
      target = target[pathArray[i]];
    }

    const lastKey = pathArray[pathArray.length - 1];
    const oldValue = target[lastKey];
    target[lastKey] = value;

    // 구독자들에게 알림
    this.notifySubscribers(path, value, oldValue);

    // 부모 경로의 구독자들에게도 알림
    this.notifyParentSubscribers(path, value);
  }

  /**
   * 상태 가져오기
   * @param {string} path - 가져올 상태 경로
   * @returns {*} 상태 값
   */
  getState(path) {
    const pathArray = path.split(".");
    let target = this.state;

    for (const key of pathArray) {
      if (target === null || target === undefined) {
        return undefined;
      }
      target = target[key];
    }

    return target;
  }

  /**
   * 상태 일괄 업데이트
   * @param {Object} updates - 업데이트할 상태들의 객체
   */
  batchUpdate(updates) {
    const notifications = [];

    for (const [path, value] of Object.entries(updates)) {
      const pathArray = path.split(".");
      let target = this.state;

      for (let i = 0; i < pathArray.length - 1; i++) {
        if (!target[pathArray[i]]) {
          target[pathArray[i]] = {};
        }
        target = target[pathArray[i]];
      }

      const lastKey = pathArray[pathArray.length - 1];
      const oldValue = target[lastKey];
      target[lastKey] = value;

      notifications.push({ path, value, oldValue });
    }

    // 모든 업데이트 완료 후 알림
    notifications.forEach(({ path, value, oldValue }) => {
      this.notifySubscribers(path, value, oldValue);
      this.notifyParentSubscribers(path, value);
    });
  }

  /**
   * 구독자들에게 알림
   */
  notifySubscribers(path, value, oldValue) {
    const callbacks = this.subscribers.get(path);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(value, oldValue, path);
        } catch (error) {
          console.error(`Error in state subscriber for ${path}:`, error);
        }
      });
    }
  }

  /**
   * 부모 경로 구독자들에게 알림
   */
  notifyParentSubscribers(path, value) {
    const pathParts = path.split(".");

    // 부모 경로들에 대해서도 알림
    for (let i = 1; i < pathParts.length; i++) {
      const parentPath = pathParts.slice(0, i).join(".");
      const parentCallbacks = this.subscribers.get(parentPath);

      if (parentCallbacks) {
        const parentValue = this.getState(parentPath);
        parentCallbacks.forEach((callback) => {
          try {
            callback(parentValue, parentValue, parentPath);
          } catch (error) {
            console.error(
              `Error in parent state subscriber for ${parentPath}:`,
              error
            );
          }
        });
      }
    }
  }

  /**
   * 이벤트 리스너 등록
   * @param {string} eventName - 이벤트 이름
   * @param {Function} listener - 리스너 함수
   * @returns {Function} 리스너 해제 함수
   */
  addEventListener(eventName, listener) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName).add(listener);

    return () => {
      const listeners = this.eventListeners.get(eventName);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * 이벤트 발생
   * @param {string} eventName - 이벤트 이름
   * @param {*} data - 이벤트 데이터
   */
  emit(eventName, data) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventName}:`, error);
        }
      });
    }
  }

  /**
   * 액션 디스패치 (Redux 스타일)
   * @param {Object} action - 액션 객체
   */
  dispatch(action) {
    switch (action.type) {
      case "UPLOAD_START":
        this.setState("isLoading", true);
        this.setState("error", null);
        break;

      case "UPLOAD_SUCCESS":
        this.batchUpdate({
          isLoading: false,
          uploadedFile: action.payload.file,
          dicomData: action.payload.data,
          error: null,
        });
        break;

      case "UPLOAD_ERROR":
        this.batchUpdate({
          isLoading: false,
          error: action.payload.error,
        });
        break;

      case "SET_VIEW":
        this.setState("currentView", action.payload.view);
        break;

      case "SET_VIEWER_MODE":
        this.setState("viewer.mode", action.payload.mode);
        break;

      case "ADD_MEASUREMENT":
        const measurements = this.getState("viewer.measurements") || [];
        this.setState("viewer.measurements", [
          ...measurements,
          action.payload.measurement,
        ]);
        break;

      case "UPDATE_MEASUREMENT":
        const currentMeasurements = this.getState("viewer.measurements") || [];
        const updatedMeasurements = currentMeasurements.map((m) =>
          m.id === action.payload.id ? { ...m, ...action.payload.updates } : m
        );
        this.setState("viewer.measurements", updatedMeasurements);
        break;

      case "DELETE_MEASUREMENT":
        const filteredMeasurements = (
          this.getState("viewer.measurements") || []
        ).filter((m) => m.id !== action.payload.id);
        this.setState("viewer.measurements", filteredMeasurements);
        break;

      case "CLEAR_MEASUREMENTS":
        this.batchUpdate({
          "viewer.measurements": [],
          "viewer.selectedMeasurement": null,
          "viewer.measurementMode": null,
          "viewer.currentPoints": [],
        });
        break;

      case "RESET_VIEWER":
        this.batchUpdate({
          "viewer.scale": 1,
          "viewer.brightness": 100,
          "viewer.contrast": 100,
          "viewer.position": { x: 0, y: 0 },
          "viewer.measurements": [],
          "viewer.selectedMeasurement": null,
          "viewer.measurementMode": null,
          "viewer.currentPoints": [],
        });
        break;

      default:
        console.warn(`Unknown action type: ${action.type}`);
    }

    // 액션 발생 이벤트 emit
    this.emit("action", action);
  }

  /**
   * 상태 초기화
   */
  reset() {
    const initialState = {
      uploadedFile: null,
      dicomData: null,
      currentView: "chart",
      isLoading: false,
      error: null,
      viewer: {
        mode: "select",
        isDragging: false,
        dragTarget: null,
        scale: 1,
        brightness: 100,
        contrast: 100,
        position: { x: 0, y: 0 },
        measurements: [],
        selectedMeasurement: null,
        measurementMode: null,
        currentPoints: [],
        annotations: {
          shapes: [],
          drawings: [],
          selectedShape: null,
          selectedDrawing: null,
          shapeMode: null,
          drawingMode: null,
          strokeWidth: 2,
          strokeColor: "#ff0000",
        },
      },
    };

    this.state = initialState;

    // 모든 구독자에게 리셋 알림
    this.emit("reset", this.state);
  }

  /**
   * 디버깅용 상태 덤프
   */
  dump() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * 로컬 스토리지에 상태 저장 (민감하지 않은 정보만)
   */
  saveToLocalStorage() {
    try {
      const saveableState = {
        currentView: this.state.currentView,
        viewer: {
          scale: this.state.viewer.scale,
          brightness: this.state.viewer.brightness,
          contrast: this.state.viewer.contrast,
          position: this.state.viewer.position,
        },
      };

      localStorage.setItem("dicom-viewer-state", JSON.stringify(saveableState));
    } catch (error) {
      console.warn("Failed to save state to localStorage:", error);
    }
  }

  /**
   * 로컬 스토리지에서 상태 복원
   */
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem("dicom-viewer-state");
      if (saved) {
        const savedState = JSON.parse(saved);

        // 안전하게 상태 복원
        if (savedState.currentView) {
          this.setState("currentView", savedState.currentView);
        }

        if (savedState.viewer) {
          const viewer = savedState.viewer;
          if (typeof viewer.scale === "number") {
            this.setState("viewer.scale", viewer.scale);
          }
          if (typeof viewer.brightness === "number") {
            this.setState("viewer.brightness", viewer.brightness);
          }
          if (typeof viewer.contrast === "number") {
            this.setState("viewer.contrast", viewer.contrast);
          }
          if (viewer.position && typeof viewer.position.x === "number") {
            this.setState("viewer.position", viewer.position);
          }
        }
      }
    } catch (error) {
      console.warn("Failed to load state from localStorage:", error);
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const appState = new AppStateManager();

// 개발 모드에서 디버깅을 위해 전역 객체에 추가
if (typeof window !== "undefined" && window.ENV?.NODE_ENV === "development") {
  window.appState = appState;
}
