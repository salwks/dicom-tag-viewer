/**
 * 파일 컨트롤러
 * 파일 선택, 업로드, 드래그 앤 드롭 처리를 담당
 */

import { appState } from "../core/appStateManager.js";
import { errorHandler } from "../core/errorHandler.js";
import { fileManager } from "../modules/fileManager.js";
import { dicomApi } from "../services/apiService.js";

export class FileController {
  constructor() {
    this.elements = {};
    this.dragCounter = 0;
    this.currentFile = null;
  }

  /**
   * 초기화
   */
  async initialize() {
    this.cacheElements();
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.setupStateSubscriptions();

    console.log("파일 컨트롤러 초기화 완료");
  }

  /**
   * DOM 요소 캐싱
   */
  cacheElements() {
    this.elements = {
      fileInput: document.getElementById("fileInput"),
      btnSelectFile: document.getElementById("btnSelectFile"),
      btnSelectFileWelcome: document.getElementById("btnSelectFileWelcome"),
      btnUpload: document.getElementById("btnUpload"),
      dropZone: document.getElementById("dropZone"),
      app: document.getElementById("app"),
    };
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 파일 입력 변경
    this.elements.fileInput?.addEventListener("change", (e) => {
      this.handleFileSelected(e.target.files[0]);
    });

    // 업로드 요청 이벤트 구독
    appState.addEventListener("upload-requested", () => {
      this.handleUploadRequested();
    });

    // 파일 선택 요청 이벤트 구독
    appState.addEventListener("file-select-requested", () => {
      this.selectFile();
    });
  }

  /**
   * 드래그 앤 드롭 설정
   */
  setupDragAndDrop() {
    const dropTarget = this.elements.app || document.body;

    // 드래그 이벤트 처리
    dropTarget.addEventListener("dragenter", (e) => {
      e.preventDefault();
      this.dragCounter++;
      this.showDropZone();
    });

    dropTarget.addEventListener("dragleave", (e) => {
      e.preventDefault();
      this.dragCounter--;
      if (this.dragCounter === 0) {
        this.hideDropZone();
      }
    });

    dropTarget.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    dropTarget.addEventListener("drop", (e) => {
      e.preventDefault();
      this.dragCounter = 0;
      this.hideDropZone();

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        this.handleFileSelected(files[0]);
      }
    });
  }

  /**
   * 상태 구독 설정
   */
  setupStateSubscriptions() {
    // 파일 선택 상태 구독
    appState.subscribe("uploadedFile", (file) => {
      this.currentFile = file;
      this.updateUploadButtonState();
    });

    // 업로드 진행률 구독
    appState.subscribe("uploadProgress", (progress) => {
      this.updateProgress(progress);
    });
  }

  /**
   * 파일 선택 트리거
   */
  selectFile() {
    this.elements.fileInput?.click();
  }

  /**
   * 파일 선택 처리
   * @param {File} file - 선택된 파일
   */
  async handleFileSelected(file) {
    if (!file) return;

    try {
      // 파일 유효성 검사
      const validation = dicomApi.validateFile(file);

      if (!validation.isValid) {
        await errorHandler.handleError({
          type: "INVALID_FILE",
          message: validation.errors.join("\n"),
        });
        return;
      }

      // 경고사항이 있으면 사용자에게 확인
      if (validation.warnings.length > 0) {
        const proceed = await this.showWarningDialog(validation.warnings);
        if (!proceed) {
          return;
        }
      }

      // 파일 상태 업데이트
      appState.setState("uploadedFile", file);

      // UI 업데이트
      this.updateFileDisplay(file);
      this.updateUploadButtonState();

      // 성공 메시지
      appState.emit("file-selected", { file, validation });
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "파일 선택 처리",
      });
    }
  }

  /**
   * 업로드 요청 처리
   */
  async handleUploadRequested() {
    if (!this.currentFile) {
      await errorHandler.handleError({
        type: "NO_FILE_SELECTED",
        message: "업로드할 파일을 먼저 선택해주세요.",
      });
      return;
    }

    try {
      // 업로드 시작
      appState.dispatch({ type: "UPLOAD_START" });

      // 진행률 콜백 설정
      const onProgress = (progress) => {
        appState.setState("uploadProgress", progress);
      };

      // 파일 업로드
      const result = await dicomApi.uploadDicom(this.currentFile, onProgress);

      if (result.success) {
        // 업로드 성공
        appState.dispatch({
          type: "UPLOAD_SUCCESS",
          payload: {
            file: this.currentFile,
            data: result.data,
          },
        });

        // 미리보기 이미지 생성
        await this.generatePreview();

        // 성공 메시지
        appState.emit("upload-completed", result);
      } else {
        throw new Error("업로드 실패");
      }
    } catch (error) {
      // 업로드 실패
      appState.dispatch({
        type: "UPLOAD_ERROR",
        payload: { error: error.message },
      });

      await errorHandler.handleError(error, {
        context: "파일 업로드",
        retry: true,
      });
    }
  }

  /**
   * 미리보기 이미지 생성
   */
  async generatePreview() {
    try {
      const previewResult = await dicomApi.generatePreview(this.currentFile);

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
      }
    } catch (error) {
      // 미리보기 생성 실패는 치명적이지 않음
      console.warn("미리보기 생성 실패:", error);
    }
  }

  /**
   * 경고 다이얼로그 표시
   * @param {Array} warnings - 경고 메시지 배열
   * @returns {Promise<boolean>} 계속 진행 여부
   */
  async showWarningDialog(warnings) {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className =
        "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
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
            그래도 계속 진행하시겠습니까?
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
   * 파일 표시 업데이트
   * @param {File} file - 파일 객체
   */
  updateFileDisplay(file) {
    // 파일 정보 업데이트는 UIController에서 처리
    appState.emit("file-info-update", {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified),
    });
  }

  /**
   * 업로드 버튼 상태 업데이트
   */
  updateUploadButtonState() {
    const hasFile = !!this.currentFile;
    const isLoading = appState.getState("isLoading");

    if (this.elements.btnUpload) {
      this.elements.btnUpload.disabled = !hasFile || isLoading;

      if (hasFile && !isLoading) {
        this.elements.btnUpload.classList.remove(
          "opacity-50",
          "cursor-not-allowed"
        );
        this.elements.btnUpload.classList.add("hover:bg-green-600");
      } else {
        this.elements.btnUpload.classList.add(
          "opacity-50",
          "cursor-not-allowed"
        );
        this.elements.btnUpload.classList.remove("hover:bg-green-600");
      }
    }
  }

  /**
   * 진행률 업데이트
   * @param {number} progress - 진행률 (0-100)
   */
  updateProgress(progress) {
    // 진행률 표시는 UIController에서 처리
    appState.emit("progress-update", { progress });
  }

  /**
   * 드롭 존 표시
   */
  showDropZone() {
    if (this.elements.dropZone) {
      this.elements.dropZone.classList.remove("hidden");
      this.elements.dropZone.classList.add("drag-active");
    }

    appState.setState("isDragOver", true);
  }

  /**
   * 드롭 존 숨김
   */
  hideDropZone() {
    if (this.elements.dropZone) {
      // 웰컴 화면이 아닌 경우에만 숨김
      const currentView = appState.getState("currentView");
      if (currentView !== "welcome") {
        this.elements.dropZone.classList.add("hidden");
      }
      this.elements.dropZone.classList.remove("drag-active");
    }

    appState.setState("isDragOver", false);
  }

  /**
   * 파일 정보 가져오기
   * @param {File} file - 파일 객체
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
   * 파일 클리어
   */
  clearFile() {
    this.currentFile = null;

    // 파일 입력 초기화
    if (this.elements.fileInput) {
      this.elements.fileInput.value = "";
    }

    // 상태 클리어
    appState.setState("uploadedFile", null);
    appState.setState("dicomData", null);
    appState.setState("uploadProgress", 0);

    // 미리보기 URL 정리
    const imageUrl = appState.getState("previewImageUrl");
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      appState.setState("previewImageUrl", null);
    }

    this.updateUploadButtonState();
  }

  /**
   * 다른 파일 선택 허용 여부 확인
   * @returns {boolean} 허용 여부
   */
  canSelectNewFile() {
    const isLoading = appState.getState("isLoading");
    return !isLoading;
  }

  /**
   * 파일 재업로드
   */
  async retryUpload() {
    if (this.currentFile) {
      await this.handleUploadRequested();
    }
  }

  /**
   * 정리
   */
  cleanup() {
    // 드래그 카운터 초기화
    this.dragCounter = 0;

    // 미리보기 URL 정리
    const imageUrl = appState.getState("previewImageUrl");
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }

    // 파일 클리어
    this.clearFile();

    console.log("파일 컨트롤러 정리 완료");
  }
}

export default FileController;
