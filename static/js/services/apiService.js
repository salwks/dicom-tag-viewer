/**
 * API 서비스 레이어
 * 모든 서버 통신을 담당하고 에러 처리, 재시도 로직을 포함
 */

import { errorHandler } from "../core/errorHandler";

class ApiService {
  constructor() {
    this.baseURL = "";
    this.timeout = 30000; // 30초
    this.defaultHeaders = {
      Accept: "application/json",
    };
  }

  /**
   * HTTP 요청 기본 메서드
   * @param {string} url - 요청 URL
   * @param {Object} options - 요청 옵션
   * @returns {Promise} 응답 데이터
   */
  async request(url, options = {}) {
    const {
      method = "GET",
      headers = {},
      body = null,
      timeout = this.timeout,
      retries = 3,
      retryDelay = 1000,
    } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const requestOptions = {
      method,
      headers: { ...this.defaultHeaders, ...headers },
      body,
      signal: controller.signal,
    };

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(this.baseURL + url, requestOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Content-Type에 따른 응답 파싱
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          return await response.json();
        } else if (contentType?.includes("image/")) {
          return await response.blob();
        } else {
          return await response.text();
        }
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error;

        // 재시도 불가능한 에러인 경우 즉시 throw
        if (!this.isRetryableError(error) || attempt === retries) {
          throw this.createApiError(error, url, options);
        }

        // 재시도 대기
        if (attempt < retries) {
          await this.delay(retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw this.createApiError(lastError, url, options);
  }

  /**
   * GET 요청
   * @param {string} url - 요청 URL
   * @param {Object} options - 옵션
   * @returns {Promise} 응답 데이터
   */
  async get(url, options = {}) {
    return this.request(url, { ...options, method: "GET" });
  }

  /**
   * POST 요청
   * @param {string} url - 요청 URL
   * @param {*} data - 요청 데이터
   * @param {Object} options - 옵션
   * @returns {Promise} 응답 데이터
   */
  async post(url, data = null, options = {}) {
    const requestOptions = { ...options, method: "POST" };

    if (data instanceof FormData) {
      requestOptions.body = data;
      // FormData의 경우 Content-Type을 자동으로 설정하도록 헤더에서 제거
      delete requestOptions.headers?.["Content-Type"];
    } else if (data) {
      requestOptions.body = JSON.stringify(data);
      requestOptions.headers = {
        "Content-Type": "application/json",
        ...requestOptions.headers,
      };
    }

    return this.request(url, requestOptions);
  }

  /**
   * PUT 요청
   * @param {string} url - 요청 URL
   * @param {*} data - 요청 데이터
   * @param {Object} options - 옵션
   * @returns {Promise} 응답 데이터
   */
  async put(url, data = null, options = {}) {
    const requestOptions = { ...options, method: "PUT" };

    if (data) {
      requestOptions.body = JSON.stringify(data);
      requestOptions.headers = {
        "Content-Type": "application/json",
        ...requestOptions.headers,
      };
    }

    return this.request(url, requestOptions);
  }

  /**
   * DELETE 요청
   * @param {string} url - 요청 URL
   * @param {Object} options - 옵션
   * @returns {Promise} 응답 데이터
   */
  async delete(url, options = {}) {
    return this.request(url, { ...options, method: "DELETE" });
  }

  /**
   * 파일 업로드
   * @param {string} url - 업로드 URL
   * @param {File} file - 업로드할 파일
   * @param {Object} options - 옵션
   * @returns {Promise} 응답 데이터
   */
  async uploadFile(url, file, options = {}) {
    const {
      onProgress = null,
      additionalData = {},
      timeout = 120000, // 2분
    } = options;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      formData.append("file", file);

      // 추가 데이터 첨부
      for (const [key, value] of Object.entries(additionalData)) {
        formData.append(key, value);
      }

      // 진행률 콜백
      if (onProgress) {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(percentComplete);
          }
        });
      }

      // 완료 처리
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            resolve(xhr.responseText);
          }
        } else {
          const error = new Error(`HTTP ${xhr.status}: ${xhr.statusText}`);
          error.response = {
            status: xhr.status,
            statusText: xhr.statusText,
            data: xhr.responseText,
          };
          reject(this.createApiError(error, url, options));
        }
      });

      // 에러 처리
      xhr.addEventListener("error", () => {
        const error = new Error("Network error");
        reject(this.createApiError(error, url, options));
      });

      // 타임아웃 처리
      xhr.addEventListener("timeout", () => {
        const error = new Error("Request timeout");
        reject(this.createApiError(error, url, options));
      });

      // 요청 전송
      xhr.open("POST", this.baseURL + url);
      xhr.timeout = timeout;
      xhr.send(formData);
    });
  }

  /**
   * 재시도 가능한 에러인지 확인
   * @param {Error} error - 에러 객체
   * @returns {boolean} 재시도 가능 여부
   */
  isRetryableError(error) {
    // 네트워크 에러
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return true;
    }

    // 요청 중단 (타임아웃)
    if (error.name === "AbortError") {
      return true;
    }

    // 5xx 서버 에러
    if (error.response?.status >= 500) {
      return true;
    }

    // 429 Too Many Requests
    if (error.response?.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * API 에러 객체 생성
   * @param {Error} originalError - 원본 에러
   * @param {string} url - 요청 URL
   * @param {Object} options - 요청 옵션
   * @returns {Error} API 에러 객체
   */
  createApiError(originalError, url, options) {
    const apiError = new Error(originalError.message);
    apiError.name = "ApiError";
    apiError.originalError = originalError;
    apiError.url = url;
    apiError.options = options;
    apiError.response = originalError.response;

    return apiError;
  }

  /**
   * 지연 함수
   * @param {number} ms - 지연 시간 (밀리초)
   * @returns {Promise} 지연 Promise
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 헬스 체크
   * @returns {Promise} 서버 상태
   */
  async healthCheck() {
    try {
      const response = await this.get("/health");
      return {
        status: "healthy",
        data: response,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
      };
    }
  }
}

/**
 * DICOM API 서비스
 * DICOM 관련 API 호출을 담당
 */
class DicomApiService extends ApiService {
  /**
   * DICOM 파일 업로드
   * @param {File} file - DICOM 파일
   * @param {Function} onProgress - 진행률 콜백
   * @returns {Promise} 업로드 결과
   */
  async uploadDicom(file, onProgress = null) {
    try {
      const response = await this.uploadFile("/upload", file, {
        onProgress,
        timeout: 120000, // 2분
      });

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "DICOM 파일 업로드",
        retry: true,
      });
      throw error;
    }
  }

  /**
   * DICOM 이미지 미리보기 생성
   * @param {File} file - DICOM 파일
   * @returns {Promise} 이미지 Blob
   */
  async generatePreview(file) {
    try {
      const blob = await this.uploadFile("/preview", file, {
        timeout: 60000, // 1분
      });

      return {
        success: true,
        imageBlob: blob,
      };
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "DICOM 미리보기 생성",
        retry: true,
      });
      throw error;
    }
  }

  /**
   * 파일 유효성 사전 검사
   * @param {File} file - 검사할 파일
   * @returns {Object} 검사 결과
   */
  validateFile(file) {
    const errors = [];
    const warnings = [];

    // 파일 존재 확인
    if (!file) {
      errors.push("파일이 선택되지 않았습니다.");
      return { isValid: false, errors, warnings };
    }

    // 파일 크기 확인
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      errors.push(
        `파일 크기가 너무 큽니다. 최대 ${
          maxSize / (1024 * 1024)
        }MB까지 허용됩니다.`
      );
    }

    if (file.size < 128) {
      errors.push(
        "파일이 너무 작습니다. 유효한 DICOM 파일이 아닐 수 있습니다."
      );
    }

    // 파일 확장자 확인
    const allowedExtensions = [".dcm", ".dicom", ".dic"];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));

    if (fileExtension && !allowedExtensions.includes(fileExtension)) {
      warnings.push(
        `일반적이지 않은 확장자입니다. DICOM 파일인지 확인해주세요.`
      );
    }

    // 파일 타입 확인
    if (
      file.type &&
      !file.type.includes("dicom") &&
      !file.type.includes("application/octet-stream")
    ) {
      warnings.push(
        "DICOM MIME 타입이 아닙니다. 파일이 올바른지 확인해주세요."
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fileInfo: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified),
      },
    };
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const apiService = new ApiService();
export const dicomApi = new DicomApiService();

// 개발 모드에서 전역 객체에 추가
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  window.apiService = apiService;
  window.dicomApi = dicomApi;
}
