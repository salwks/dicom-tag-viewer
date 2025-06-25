/**
 * 파일 관리 모듈
 * 파일 업로드, 검증, 처리를 담당
 */

import { appState } from "/static/js/core/appStateManager.js";
import { errorHandler } from "/static/js/core/errorHandler.js";
import { dicomApi } from "/static/js/services/apiService.js";

class FileManager {
  constructor() {
    this.allowedTypes = [".dcm", ".dicom", ".dic"];
    this.maxFileSize = 100 * 1024 * 1024; // 100MB
    this.uploadQueue = [];
    this.isProcessing = false;
  }

  /**
   * 파일 선택 처리
   * @param {File} file - 선택된 파일
   * @returns {Promise} 처리 결과
   */
  async selectFile(file) {
    try {
      // 파일 유효성 검사
      const validation = dicomApi.validateFile(file);

      if (!validation.isValid) {
        await errorHandler.handleError({
          type: "INVALID_FILE",
          message: validation.errors.join("\n"),
        });
        return { success: false, errors: validation.errors };
      }

      // 경고사항이 있으면 사용자에게 알림
      if (validation.warnings.length > 0) {
        await this.showWarnings(validation.warnings);
      }

      // 상태 업데이트
      appState.setState("uploadedFile", file);
      appState.emit("file-selected", { file, validation });

      return { success: true, file, validation };
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "파일 선택 처리",
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * 파일 업로드 및 처리
   * @param {File} file - 업로드할 파일
   * @returns {Promise} 업로드 결과
   */
  async uploadFile(file) {
    if (this.isProcessing) {
      throw new Error("다른 파일이 처리 중입니다. 잠시 후 다시 시도해주세요.");
    }

    this.isProcessing = true;

    try {
      // 업로드 시작 상태 설정
      appState.dispatch({ type: "UPLOAD_START" });

      // 진행률 콜백 설정
      const onProgress = (progress) => {
        appState.setState("uploadProgress", progress);
        appState.emit("upload-progress", { progress });
      };

      // DICOM 파일 업로드
      const uploadResult = await dicomApi.uploadDicom(file, onProgress);

      if (uploadResult.success) {
        // 업로드 성공 상태 설정
        appState.dispatch({
          type: "UPLOAD_SUCCESS",
          payload: {
            file: file,
            data: uploadResult.data,
          },
        });

        // 미리보기 이미지 생성
        await this.generatePreviewImage(file);

        return {
          success: true,
          data: uploadResult.data,
        };
      } else {
        throw new Error("업로드 실패");
      }
    } catch (error) {
      // 업로드 실패 상태 설정
      appState.dispatch({
        type: "UPLOAD_ERROR",
        payload: { error: error.message },
      });

      await errorHandler.handleError(error, {
        context: "파일 업로드",
        retry: true,
      });

      throw error;
    } finally {
      this.isProcessing = false;
      appState.setState("uploadProgress", 0);
    }
  }

  /**
   * 미리보기 이미지 생성
   * @param {File} file - DICOM 파일
   * @returns {Promise} 생성 결과
   */
  async generatePreviewImage(file) {
    try {
      const previewResult = await dicomApi.generatePreview(file);

      if (previewResult.success) {
        // Blob URL 생성
        const imageUrl = URL.createObjectURL(previewResult.imageBlob);

        // 기존 URL 정리
        const currentImageUrl = appState.getState("previewImageUrl");
        if (currentImageUrl) {
          URL.revokeObjectURL(currentImageUrl);
        }

        // 상태 업데이트
        appState.setState("previewImageUrl", imageUrl);
        appState.emit("preview-generated", { imageUrl });

        return { success: true, imageUrl };
      }
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "미리보기 생성",
        silent: true, // 미리보기 실패는 치명적이지 않음
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * 드래그 앤 드롭 이벤트 설정
   * @param {HTMLElement} dropZone - 드롭 영역
   */
  setupDragAndDrop(dropZone) {
    let dragCounter = 0;

    // 드래그 오버 효과
    const addDragOverEffect = () => {
      dropZone.classList.add("drag-over");
      appState.setState("isDragOver", true);
    };

    const removeDragOverEffect = () => {
      dropZone.classList.remove("drag-over");
      appState.setState("isDragOver", false);
    };

    // 이벤트 리스너들
    dropZone.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragCounter++;
      addDragOverEffect();
    });

    dropZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) {
        removeDragOverEffect();
      }
    });

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      dragCounter = 0;
      removeDragOverEffect();

      const files = Array.from(e.dataTransfer.files);

      if (files.length === 0) {
        await errorHandler.handleError({
          type: "NO_FILES",
          message: "드롭된 파일이 없습니다.",
        });
        return;
      }

      if (files.length > 1) {
        await errorHandler.handleError({
          type: "MULTIPLE_FILES",
          message: "한 번에 하나의 파일만 업로드할 수 있습니다.",
        });
        return;
      }

      // 파일 처리
      await this.selectFile(files[0]);
    });
  }

  /**
   * 파일 입력 요소 설정
   * @param {HTMLInputElement} fileInput - 파일 입력 요소
   */
  setupFileInput(fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.selectFile(file);
      }
    });

    // accept 속성 설정
    fileInput.accept = this.allowedTypes.join(",");
  }

  /**
   * 경고사항 표시
   * @param {Array} warnings - 경고 메시지 배열
   */
  async showWarnings(warnings) {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className =
        "warning-modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
      modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-lg max-w-md mx-4">
          <div class="flex items-center mb-4">
            <span class="text-2xl mr-3">⚠️</span>
            <h3 class="text-lg font-bold text-yellow-700">주의사항</h3>
          </div>
          <div class="mb-4">
            ${warnings
              .map(
                (warning) => `<p class="text-gray-700 mb-2">• ${warning}</p>`
              )
              .join("")}
          </div>
          <div class="text-sm text-gray-600 mb-4">
            계속 진행하시겠습니까?
          </div>
          <div class="flex space-x-2 justify-end">
            <button class="cancel-btn px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
              취소
            </button>
            <button class="continue-btn px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">
              계속
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector(".cancel-btn").addEventListener("click", () => {
        modal.remove();
        resolve(false);
      });

      modal.querySelector(".continue-btn").addEventListener("click", () => {
        modal.remove();
        resolve(true);
      });

      // ESC 키로 닫기
      const handleEsc = (e) => {
        if (e.key === "Escape") {
          modal.remove();
          document.removeEventListener("keydown", handleEsc);
          resolve(false);
        }
      };
      document.addEventListener("keydown", handleEsc);
    });
  }

  /**
   * 업로드 큐에 파일 추가
   * @param {File} file - 추가할 파일
   */
  addToQueue(file) {
    this.uploadQueue.push({
      file,
      id: Date.now(),
      status: "pending",
    });

    appState.setState("uploadQueue", [...this.uploadQueue]);
  }

  /**
   * 큐 처리
   */
  async processQueue() {
    if (this.isProcessing || this.uploadQueue.length === 0) {
      return;
    }

    const nextItem = this.uploadQueue.find((item) => item.status === "pending");
    if (!nextItem) {
      return;
    }

    nextItem.status = "processing";
    appState.setState("uploadQueue", [...this.uploadQueue]);

    try {
      await this.uploadFile(nextItem.file);
      nextItem.status = "completed";
    } catch (error) {
      nextItem.status = "failed";
      nextItem.error = error.message;
    }

    appState.setState("uploadQueue", [...this.uploadQueue]);

    // 다음 아이템 처리
    setTimeout(() => this.processQueue(), 100);
  }

  /**
   * 큐 클리어
   */
  clearQueue() {
    this.uploadQueue = [];
    appState.setState("uploadQueue", []);
  }

  /**
   * 파일 정보 추출
   * @param {File} file - 파일
   * @returns {Object} 파일 정보
   */
  getFileInfo(file) {
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified),
      sizeFormatted: this.formatFileSize(file.size),
    };
  }

  /**
   * 파일 크기 포맷팅
   * @param {number} bytes - 바이트 크기
   * @returns {string} 포맷된 크기
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * 메모리 정리
   */
  cleanup() {
    // Blob URLs 정리
    const imageUrl = appState.getState("previewImageUrl");
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    // 큐 클리어
    this.clearQueue();

    // 상태 초기화
    appState.setState("uploadedFile", null);
    appState.setState("previewImageUrl", null);
    appState.setState("uploadProgress", 0);
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const fileManager = new FileManager();

// 개발 모드에서 전역 객체에 추가
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  window.fileManager = fileManager;
}
