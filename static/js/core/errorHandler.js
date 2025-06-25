/**
 * 통합 에러 처리 시스템
 * 애플리케이션 전반의 에러를 처리하고 사용자에게 친화적인 메시지를 제공
 */

class ErrorHandler {
  constructor() {
    this.errorQueue = [];
    this.isShowingError = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1초

    // 에러 타입별 메시지 정의
    this.errorMessages = {
      // 네트워크 에러
      NETWORK_ERROR: "네트워크 연결을 확인해주세요.",
      TIMEOUT_ERROR: "요청 시간이 초과되었습니다. 다시 시도해주세요.",
      CONNECTION_ERROR: "서버에 연결할 수 없습니다.",

      // 파일 에러
      FILE_TOO_LARGE: "파일 크기가 너무 큽니다.",
      INVALID_FILE_TYPE: "지원하지 않는 파일 형식입니다.",
      FILE_CORRUPTED: "파일이 손상되었습니다.",
      DICOM_PARSE_ERROR: "DICOM 파일을 읽을 수 없습니다.",

      // 서버 에러
      SERVER_ERROR: "서버 오류가 발생했습니다.",
      SERVICE_UNAVAILABLE: "서비스를 일시적으로 사용할 수 없습니다.",

      // 클라이언트 에러
      INVALID_INPUT: "입력값이 올바르지 않습니다.",
      PERMISSION_DENIED: "권한이 없습니다.",

      // 일반 에러
      UNKNOWN_ERROR: "알 수 없는 오류가 발생했습니다.",
    };

    // 전역 에러 핸들러 등록
    this.setupGlobalErrorHandlers();
  }

  /**
   * 전역 에러 핸들러 설정
   */
  setupGlobalErrorHandlers() {
    // JavaScript 에러
    window.addEventListener("error", (event) => {
      this.handleError({
        type: "JAVASCRIPT_ERROR",
        message: event.error?.message || event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Promise rejection 에러
    window.addEventListener("unhandledrejection", (event) => {
      this.handleError({
        type: "PROMISE_REJECTION",
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
      });
    });
  }

  /**
   * 에러 처리 메인 함수
   * @param {Object} error - 에러 객체
   * @param {Object} options - 처리 옵션
   */
  async handleError(error, options = {}) {
    const {
      silent = false,
      retry = false,
      retryCount = 0,
      context = null,
      userMessage = null,
    } = options;

    // 에러 로깅
    this.logError(error, context);

    // 에러 분류 및 처리
    const processedError = this.processError(error);

    // 재시도 로직
    if (retry && retryCount < this.maxRetries && this.isRetryableError(error)) {
      await this.retryOperation(error, options);
      return;
    }

    // 사용자에게 에러 표시 (silent가 아닌 경우)
    if (!silent) {
      const message =
        userMessage || this.getUserFriendlyMessage(processedError);
      await this.showErrorToUser(processedError, message);
    }

    // 상태 관리자에 에러 정보 업데이트
    if (window.appState) {
      window.appState.setState("error", {
        type: processedError.type,
        message: processedError.message,
        timestamp: new Date().toISOString(),
        context: context,
      });
    }
  }

  /**
   * 에러 분류 및 표준화
   * @param {*} error - 원본 에러
   * @returns {Object} 처리된 에러 객체
   */
  processError(error) {
    // 이미 처리된 에러인 경우
    if (error.type && error.message) {
      return error;
    }

    // HTTP 에러 처리
    if (error.response) {
      return this.processHttpError(error);
    }

    // 네트워크 에러 처리
    if (error.code === "NETWORK_ERROR" || !navigator.onLine) {
      return {
        type: "NETWORK_ERROR",
        message: this.errorMessages.NETWORK_ERROR,
        originalError: error,
      };
    }

    // 파일 관련 에러 처리
    if (error.name === "InvalidDicomError") {
      return {
        type: "DICOM_PARSE_ERROR",
        message: this.errorMessages.DICOM_PARSE_ERROR,
        originalError: error,
      };
    }

    // JavaScript 에러 처리
    if (error instanceof Error) {
      return {
        type: "JAVASCRIPT_ERROR",
        message: error.message,
        stack: error.stack,
        originalError: error,
      };
    }

    // 기본 에러 처리
    return {
      type: "UNKNOWN_ERROR",
      message: String(error),
      originalError: error,
    };
  }

  /**
   * HTTP 에러 처리
   * @param {Object} error - HTTP 에러 객체
   * @returns {Object} 처리된 에러
   */
  processHttpError(error) {
    const status = error.response?.status;
    const data = error.response?.data;

    switch (status) {
      case 400:
        return {
          type: "INVALID_INPUT",
          message: data?.error || this.errorMessages.INVALID_INPUT,
          originalError: error,
        };
      case 401:
      case 403:
        return {
          type: "PERMISSION_DENIED",
          message: this.errorMessages.PERMISSION_DENIED,
          originalError: error,
        };
      case 413:
        return {
          type: "FILE_TOO_LARGE",
          message: data?.error || this.errorMessages.FILE_TOO_LARGE,
          originalError: error,
        };
      case 500:
        return {
          type: "SERVER_ERROR",
          message: this.errorMessages.SERVER_ERROR,
          originalError: error,
        };
      case 503:
        return {
          type: "SERVICE_UNAVAILABLE",
          message: this.errorMessages.SERVICE_UNAVAILABLE,
          originalError: error,
        };
      default:
        return {
          type: "UNKNOWN_ERROR",
          message: data?.error || this.errorMessages.UNKNOWN_ERROR,
          originalError: error,
        };
    }
  }

  /**
   * 재시도 가능한 에러인지 확인
   * @param {Object} error - 에러 객체
   * @returns {boolean} 재시도 가능 여부
   */
  isRetryableError(error) {
    const retryableTypes = [
      "NETWORK_ERROR",
      "TIMEOUT_ERROR",
      "CONNECTION_ERROR",
      "SERVICE_UNAVAILABLE",
    ];

    return (
      retryableTypes.includes(error.type) ||
      (error.response?.status >= 500 && error.response?.status < 600)
    );
  }

  /**
   * 재시도 로직
   * @param {Object} error - 원본 에러
   * @param {Object} options - 옵션
   */
  async retryOperation(error, options) {
    const delay = this.retryDelay * Math.pow(2, options.retryCount); // 지수 백오프

    await new Promise((resolve) => setTimeout(resolve, delay));

    // 재시도 이벤트 발생
    if (window.appState) {
      window.appState.emit("retry", {
        error: error,
        retryCount: options.retryCount + 1,
        delay: delay,
      });
    }
  }

  /**
   * 사용자 친화적 메시지 생성
   * @param {Object} error - 처리된 에러
   * @returns {string} 사용자 메시지
   */
  getUserFriendlyMessage(error) {
    const baseMessage = this.errorMessages[error.type] || error.message;

    // 에러 타입별 추가 정보 제공
    switch (error.type) {
      case "FILE_TOO_LARGE":
        return `${baseMessage} 100MB 이하의 파일을 선택해주세요.`;
      case "INVALID_FILE_TYPE":
        return `${baseMessage} .dcm, .dicom 파일만 지원됩니다.`;
      case "NETWORK_ERROR":
        return `${baseMessage} 인터넷 연결을 확인하고 다시 시도해주세요.`;
      case "SERVER_ERROR":
        return `${baseMessage} 잠시 후 다시 시도해주세요.`;
      default:
        return baseMessage;
    }
  }

  /**
   * 사용자에게 에러 표시
   * @param {Object} error - 에러 객체
   * @param {string} message - 사용자 메시지
   */
  async showErrorToUser(error, message) {
    // 에러가 이미 표시 중인 경우 큐에 추가
    if (this.isShowingError) {
      this.errorQueue.push({ error, message });
      return;
    }

    this.isShowingError = true;

    try {
      await this.displayErrorModal(error, message);
    } finally {
      this.isShowingError = false;

      // 큐에 대기 중인 에러 처리
      if (this.errorQueue.length > 0) {
        const next = this.errorQueue.shift();
        setTimeout(() => this.showErrorToUser(next.error, next.message), 100);
      }
    }
  }

  /**
   * 에러 모달 표시
   * @param {Object} error - 에러 객체
   * @param {string} message - 사용자 메시지
   */
  async displayErrorModal(error, message) {
    return new Promise((resolve) => {
      // 기존 에러 모달 제거
      const existingModal = document.querySelector(".error-modal");
      if (existingModal) {
        existingModal.remove();
      }

      // 에러 심각도에 따른 스타일 결정
      const isError = [
        "SERVER_ERROR",
        "DICOM_PARSE_ERROR",
        "FILE_CORRUPTED",
      ].includes(error.type);
      const isWarning = ["FILE_TOO_LARGE", "INVALID_FILE_TYPE"].includes(
        error.type
      );

      let bgColor, textColor, icon;
      if (isError) {
        bgColor = "bg-red-500";
        textColor = "text-red-700";
        icon = "❌";
      } else if (isWarning) {
        bgColor = "bg-yellow-500";
        textColor = "text-yellow-700";
        icon = "⚠️";
      } else {
        bgColor = "bg-blue-500";
        textColor = "text-blue-700";
        icon = "ℹ️";
      }

      const modal = document.createElement("div");
      modal.className =
        "error-modal fixed top-20 right-4 z-50 max-w-md p-4 bg-white rounded-lg shadow-lg border-l-4 " +
        bgColor.replace("bg-", "border-");
      modal.innerHTML = `
          <div class="flex items-start">
            <span class="text-2xl mr-3">${icon}</span>
            <div class="flex-1">
              <h3 class="font-bold ${textColor} mb-2">오류 발생</h3>
              <p class="text-gray-700 mb-3">${message}</p>
              <div class="flex space-x-2">
                <button class="error-close px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">
                  확인
                </button>
                ${
                  this.isRetryableError(error)
                    ? `
                  <button class="error-retry px-3 py-1 ${bgColor} text-white rounded text-sm hover:opacity-80">
                    다시 시도
                  </button>
                `
                    : ""
                }
              </div>
            </div>
          </div>
        `;

      document.body.appendChild(modal);

      // 자동 제거 타이머
      const autoRemoveTimer = setTimeout(() => {
        modal.remove();
        resolve();
      }, 10000);

      // 닫기 버튼 이벤트
      modal.querySelector(".error-close").addEventListener("click", () => {
        clearTimeout(autoRemoveTimer);
        modal.remove();
        resolve();
      });

      // 재시도 버튼 이벤트 (있는 경우)
      const retryButton = modal.querySelector(".error-retry");
      if (retryButton) {
        retryButton.addEventListener("click", () => {
          clearTimeout(autoRemoveTimer);
          modal.remove();

          // 재시도 이벤트 발생
          if (window.appState) {
            window.appState.emit("retry-requested", error);
          }

          resolve();
        });
      }

      // 애니메이션 효과
      modal.style.transform = "translateX(100%)";
      modal.style.transition = "transform 0.3s ease";
      setTimeout(() => {
        modal.style.transform = "translateX(0)";
      }, 10);
    });
  }

  /**
   * 에러 로깅
   * @param {Object} error - 에러 객체
   * @param {*} context - 추가 컨텍스트
   */
  logError(error, context) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      error: {
        type: error.type || "UNKNOWN",
        message: error.message,
        stack: error.stack,
        originalError: error.originalError,
      },
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // 콘솔에 로깅
    console.error("[ErrorHandler]", logEntry);

    // 개발 모드가 아닌 경우 서버로 에러 로그 전송
    if (window.ENV?.NODE_ENV === "production") {
      this.sendErrorToServer(logEntry);
    }
  }

  /**
   * 서버로 에러 로그 전송
   * @param {Object} logEntry - 로그 엔트리
   */
  async sendErrorToServer(logEntry) {
    try {
      await fetch("/api/error-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(logEntry),
      });
    } catch (err) {
      // 에러 로깅 실패는 무시 (무한 루프 방지)
      console.warn("Failed to send error log to server:", err);
    }
  }

  /**
   * 에러 큐 클리어
   */
  clearErrorQueue() {
    this.errorQueue = [];
  }

  /**
   * 특정 타입의 에러 핸들러 등록
   * @param {string} errorType - 에러 타입
   * @param {Function} handler - 핸들러 함수
   */
  registerErrorHandler(errorType, handler) {
    if (window.appState) {
      window.appState.addEventListener(`error:${errorType}`, handler);
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const errorHandler = new ErrorHandler();

// 전역 객체에 추가 (개발 모드)
if (typeof window !== "undefined" && window.ENV?.NODE_ENV === "development") {
  window.errorHandler = errorHandler;
}
