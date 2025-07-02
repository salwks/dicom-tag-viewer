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
      previewImageUrl: null,

      // UI 상태
      currentView: "welcome", // 'welcome', 'chart', 'table', 'viewer'
      isLoading: false,
      error: null,
      isDragOver: false,
      isOnline: navigator.onLine,
      browserFeatures: {},

      // 업로드 상태
      uploadProgress: 0,

      // 뷰어 상태
      viewer: {
        mode: "select", // 'select', 'pan'
        isDragging: false,
        imageLoaded: false,

        // 이미지 변환 상태
        transform: {
          scale: 1,
          translateX: 0,
          translateY: 0,
          rotation: 0,
        },

        // 이미지 조정
        adjustments: {
          brightness: 0,
          contrast: 1,
          gamma: 1,
          window: null,
          level: null,
          invert: false,
        },

        // 측정 상태
        measurements: [],
        selectedMeasurement: null,
        measurementMode: null, // 'distance', 'angle', 'area', null
        currentPoints: [],

        // 히스토그램
        histogram: null,
      },
    };

    this.subscribers = new Map();
    this.eventListeners = new Map();

    // 순환 호출 방지
    this._isUpdating = false;
    this._updateQueue = [];
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
        if (callbacks.size === 0) {
          this.subscribers.delete(path);
        }
      }
    };
  }

  /**
   * 상태 업데이트
   * @param {string} path - 업데이트할 상태 경로
   * @param {*} value - 새로운 값
   */
  setState(path, value) {
    // 순환 호출 방지
    if (this._isUpdating) {
      this._updateQueue.push({ path, value });
      return;
    }

    this._isUpdating = true;

    try {
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

      // 값이 실제로 변경된 경우에만 처리
      if (this.deepEquals(oldValue, value)) {
        return;
      }

      target[lastKey] = value;

      // 구독자들에게 알림
      this.notifySubscribers(path, value, oldValue);

      // 부모 경로의 구독자들에게도 알림
      this.notifyParentSubscribers(path, value);
    } finally {
      this._isUpdating = false;

      // 큐에 있는 업데이트 처리
      if (this._updateQueue.length > 0) {
        const updates = [...this._updateQueue];
        this._updateQueue = [];

        // 다음 tick에서 처리하여 스택 오버플로우 방지
        setTimeout(() => {
          updates.forEach(({ path, value }) => {
            this.setState(path, value);
          });
        }, 0);
      }
    }
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
    if (this._isUpdating) {
      Object.entries(updates).forEach(([path, value]) => {
        this._updateQueue.push({ path, value });
      });
      return;
    }

    const notifications = [];
    this._isUpdating = true;

    try {
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

        // 값이 실제로 변경된 경우에만 처리
        if (!this.deepEquals(oldValue, value)) {
          target[lastKey] = value;
          notifications.push({ path, value, oldValue });
        }
      }

      // 모든 업데이트 완료 후 알림
      notifications.forEach(({ path, value, oldValue }) => {
        this.notifySubscribers(path, value, oldValue);
        this.notifyParentSubscribers(path, value);
      });
    } finally {
      this._isUpdating = false;
    }
  }

  /**
   * 깊은 비교
   * @param {*} a - 첫 번째 값
   * @param {*} b - 두 번째 값
   * @returns {boolean} 같은지 여부
   */
  deepEquals(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a !== "object") return a === b;

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (let key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEquals(a[key], b[key])) return false;
    }

    return true;
  }

  /**
   * 구독자들에게 알림
   */
  notifySubscribers(path, value, oldValue) {
    const callbacks = this.subscribers.get(path);
    if (callbacks) {
      // 콜백 실행을 다음 tick으로 지연시켜 스택 오버플로우 방지
      setTimeout(() => {
        callbacks.forEach(callback => {
          try {
            callback(value, oldValue, path);
          } catch (error) {
            console.error(`Error in state subscriber for ${path}:`, error);
          }
        });
      }, 0);
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
        setTimeout(() => {
          parentCallbacks.forEach(callback => {
            try {
              callback(parentValue, parentValue, parentPath);
            } catch (error) {
              console.error(
                `Error in parent state subscriber for ${parentPath}:`,
                error
              );
            }
          });
        }, 0);
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
        if (listeners.size === 0) {
          this.eventListeners.delete(eventName);
        }
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
      // 이벤트 처리를 다음 tick으로 지연
      setTimeout(() => {
        listeners.forEach(listener => {
          try {
            listener(data);
          } catch (error) {
            console.error(`Error in event listener for ${eventName}:`, error);
          }
        });
      }, 0);
    }
  }

  /**
   * 액션 디스패치 (Redux 스타일)
   * @param {Object} action - 액션 객체
   */
  dispatch(action) {
    // 디스패치도 다음 tick으로 지연하여 스택 오버플로우 방지
    setTimeout(() => {
      this._handleAction(action);
    }, 0);
  }

  /**
   * 액션 처리 (내부)
   * @param {Object} action - 액션 객체
   */
  _handleAction(action) {
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
        const updatedMeasurements = currentMeasurements.map(m =>
          m.id === action.payload.id ? { ...m, ...action.payload.updates } : m
        );
        this.setState("viewer.measurements", updatedMeasurements);
        break;

      case "DELETE_MEASUREMENT":
        const filteredMeasurements = (
          this.getState("viewer.measurements") || []
        ).filter(m => m.id !== action.payload.id);
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
          "viewer.transform": {
            scale: 1,
            translateX: 0,
            translateY: 0,
            rotation: 0,
          },
          "viewer.adjustments": {
            brightness: 0,
            contrast: 1,
            gamma: 1,
            window: null,
            level: null,
            invert: false,
          },
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
    // 기존 구독자와 리스너는 유지하고 상태만 초기화
    this.state = {
      uploadedFile: null,
      dicomData: null,
      previewImageUrl: null,
      currentView: "welcome",
      isLoading: false,
      error: null,
      isDragOver: false,
      isOnline: navigator.onLine,
      browserFeatures: {},
      uploadProgress: 0,
      viewer: {
        mode: "select",
        isDragging: false,
        imageLoaded: false,
        transform: {
          scale: 1,
          translateX: 0,
          translateY: 0,
          rotation: 0,
        },
        adjustments: {
          brightness: 0,
          contrast: 1,
          gamma: 1,
          window: null,
          level: null,
          invert: false,
        },
        measurements: [],
        selectedMeasurement: null,
        measurementMode: null,
        currentPoints: [],
        histogram: null,
      },
    };

    // 리셋 이벤트 발생
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
          transform: this.state.viewer.transform,
          adjustments: this.state.viewer.adjustments,
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
        if (savedState.currentView && savedState.currentView !== "welcome") {
          // 웰컴 화면이 아닌 경우에만 복원 (파일이 없으면 웰컴으로)
          this.setState("currentView", "welcome");
        }

        if (savedState.viewer) {
          const viewer = savedState.viewer;
          if (viewer.transform && typeof viewer.transform === "object") {
            this.setState("viewer.transform", viewer.transform);
          }
          if (viewer.adjustments && typeof viewer.adjustments === "object") {
            this.setState("viewer.adjustments", viewer.adjustments);
          }
        }
      }
    } catch (error) {
      console.warn("Failed to load state from localStorage:", error);
    }
  }

  /**
   * 정리 (메모리 해제)
   */
  cleanup() {
    this.subscribers.clear();
    this.eventListeners.clear();
    this._updateQueue = [];
    this._isUpdating = false;
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const appState = new AppStateManager();

// 개발 모드에서 디버깅을 위해 전역 객체에 추가
if (typeof window !== "undefined" && window.ENV?.NODE_ENV === "development") {
  window.appState = appState;
}
