/**
 * 이미지 처리 엔진
 * DICOM 이미지의 표시, 조작, 변환을 담당
 */

import { appState } from "../core/appStateManager.js";
import { errorHandler } from "../core/errorHandler.js";

class ImageProcessor {
  constructor() {
    this.canvas = null;
    this.context = null;
    this.imageData = null;
    this.originalImageData = null;

    // 변환 매트릭스
    this.transform = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
    };

    // 이미지 조정 값
    this.adjustments = {
      brightness: 0, // -100 to 100
      contrast: 1, // 0 to 2
      gamma: 1, // 0.1 to 3
      window: null, // Window/Level 값
      level: null,
      invert: false,
    };

    // 히스토그램 데이터
    this.histogram = null;
  }

  /**
   * 캔버스 초기화
   * @param {HTMLCanvasElement} canvas - 캔버스 요소
   */
  initializeCanvas(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");

    // 이미지 스무딩 비활성화 (의료영상의 정확성을 위해)
    this.context.imageSmoothingEnabled = false;
  }

  /**
   * 이미지 로드
   * @param {string|ImageData} source - 이미지 소스 (URL 또는 ImageData)
   * @returns {Promise} 로드 완료 Promise
   */
  async loadImage(source) {
    try {
      if (source instanceof ImageData) {
        this.imageData = source;
        this.originalImageData = this.cloneImageData(source);
      } else if (typeof source === "string") {
        // URL에서 이미지 로드
        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise((resolve, reject) => {
          img.onload = () => {
            this.canvas.width = img.width;
            this.canvas.height = img.height;
            this.context.drawImage(img, 0, 0);

            this.imageData = this.context.getImageData(
              0,
              0,
              img.width,
              img.height
            );
            this.originalImageData = this.cloneImageData(this.imageData);
            resolve();
          };
          img.onerror = reject;
          img.src = source;
        });
      }

      // 히스토그램 계산
      this.calculateHistogram();

      // 상태 업데이트
      appState.setState("viewer.imageLoaded", true);
      appState.emit("image-loaded", {
        width: this.imageData.width,
        height: this.imageData.height,
      });

      return this.imageData;
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "이미지 로드",
      });
      throw error;
    }
  }

  /**
   * 이미지 변환 적용
   * @param {Object} newTransform - 새로운 변환 값
   */
  applyTransform(newTransform) {
    // 기본값으로 초기화
    if (!this.transform) {
      this.transform = {
        scale: 1,
        translateX: 0,
        translateY: 0,
        rotation: 0,
      };
    }

    // 안전한 값으로 업데이트
    Object.keys(newTransform).forEach(key => {
      const value = newTransform[key];
      if (!isNaN(value) && isFinite(value)) {
        this.transform[key] = value;
      }
    });

    this.render();
    appState.setState("viewer.transform", { ...this.transform });
  }

  /**
   * 이미지 조정 적용
   * @param {Object} newAdjustments - 새로운 조정 값
   */
  applyAdjustments(newAdjustments) {
    Object.assign(this.adjustments, newAdjustments);
    this.processImage();
    this.render();

    appState.setState("viewer.adjustments", { ...this.adjustments });
  }

  /**
   * 이미지 처리 (밝기, 대비, 감마 등)
   */
  processImage() {
    if (!this.originalImageData) return;

    const processed = this.cloneImageData(this.originalImageData);
    const data = processed.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 그레이스케일로 변환 (의료영상은 보통 그레이스케일)
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Window/Level 적용 (DICOM 표준)
      let processed_gray = gray;
      if (this.adjustments.window !== null && this.adjustments.level !== null) {
        processed_gray = this.applyWindowLevel(
          gray,
          this.adjustments.window,
          this.adjustments.level
        );
      }

      // 밝기 조정
      processed_gray += this.adjustments.brightness * 2.55; // -100~100을 -255~255로 변환

      // 대비 조정
      processed_gray = (processed_gray - 128) * this.adjustments.contrast + 128;

      // 감마 보정
      if (this.adjustments.gamma !== 1) {
        processed_gray =
          255 * Math.pow(processed_gray / 255, 1 / this.adjustments.gamma);
      }

      // 반전
      if (this.adjustments.invert) {
        processed_gray = 255 - processed_gray;
      }

      // 클램핑
      processed_gray = Math.max(0, Math.min(255, processed_gray));

      data[i] = processed_gray; // R
      data[i + 1] = processed_gray; // G
      data[i + 2] = processed_gray; // B
      // 알파 채널은 그대로 유지
    }

    this.imageData = processed;
  }

  /**
   * Window/Level 적용 (DICOM 표준)
   * @param {number} pixelValue - 픽셀 값
   * @param {number} window - 윈도우 폭
   * @param {number} level - 윈도우 중심
   * @returns {number} 처리된 픽셀 값
   */
  applyWindowLevel(pixelValue, window, level) {
    const halfWindow = window / 2;
    const minValue = level - halfWindow;
    const maxValue = level + halfWindow;

    if (pixelValue <= minValue) {
      return 0;
    } else if (pixelValue >= maxValue) {
      return 255;
    } else {
      return ((pixelValue - minValue) / window) * 255;
    }
  }

  /**
   * 이미지 렌더링
   */
  render() {
    if (!this.imageData || !this.context) return;

    // 캔버스 클리어
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 변환 매트릭스 적용
    this.context.save();
    this.context.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.context.scale(this.transform.scale, this.transform.scale);
    this.context.rotate((this.transform.rotation * Math.PI) / 180);
    this.context.translate(
      this.transform.translateX - this.imageData.width / 2,
      this.transform.translateY - this.imageData.height / 2
    );

    // 이미지 그리기
    this.context.putImageData(this.imageData, 0, 0);

    this.context.restore();
  }

  /**
   * 히스토그램 계산
   */
  calculateHistogram() {
    if (!this.originalImageData) return;

    const histogram = new Array(256).fill(0);
    const data = this.originalImageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // 그레이스케일 값 계산
      const gray = Math.round(
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      );
      histogram[gray]++;
    }

    this.histogram = histogram;
    appState.setState("viewer.histogram", histogram);
  }

  /**
   * 자동 대비 조정
   */
  autoContrast() {
    if (!this.histogram) return;

    // 히스토그램 분석
    let min = 0,
      max = 255;
    let totalPixels = 0;

    for (let i = 0; i < 256; i++) {
      totalPixels += this.histogram[i];
    }

    // 1%ile과 99%ile 찾기
    const threshold = totalPixels * 0.01;
    let cumulative = 0;

    for (let i = 0; i < 256; i++) {
      cumulative += this.histogram[i];
      if (cumulative >= threshold) {
        min = i;
        break;
      }
    }

    cumulative = 0;
    for (let i = 255; i >= 0; i--) {
      cumulative += this.histogram[i];
      if (cumulative >= threshold) {
        max = i;
        break;
      }
    }

    // Window/Level 계산
    const window = max - min;
    const level = (max + min) / 2;

    this.applyAdjustments({ window, level });
  }

  /**
   * 자동 밝기 조정
   */
  autoBrightness() {
    if (!this.histogram) return;

    // 평균 밝기 계산
    let totalValue = 0;
    let totalPixels = 0;

    for (let i = 0; i < 256; i++) {
      totalValue += i * this.histogram[i];
      totalPixels += this.histogram[i];
    }

    const averageBrightness = totalValue / totalPixels;
    const targetBrightness = 128; // 중간 밝기
    const adjustment = (targetBrightness - averageBrightness) / 2.55; // -100~100 범위로 변환

    this.applyAdjustments({ brightness: adjustment });
  }

  /**
   * 좌표 변환 (캔버스 좌표 -> 이미지 좌표)
   * @param {number} canvasX - 캔버스 X 좌표
   * @param {number} canvasY - 캔버스 Y 좌표
   * @returns {Object} 이미지 좌표
   */
  canvasToImageCoordinates(canvasX, canvasY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = canvasX - rect.left;
    const y = canvasY - rect.top;

    // 변환 역산
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    const adjustedX =
      (x - centerX) / this.transform.scale -
      this.transform.translateX +
      this.imageData.width / 2;
    const adjustedY =
      (y - centerY) / this.transform.scale -
      this.transform.translateY +
      this.imageData.height / 2;

    return {
      x: Math.round(adjustedX),
      y: Math.round(adjustedY),
      relativeX: adjustedX / this.imageData.width,
      relativeY: adjustedY / this.imageData.height,
    };
  }

  /**
   * 좌표 변환 (이미지 좌표 -> 캔버스 좌표)
   * @param {number} imageX - 이미지 X 좌표
   * @param {number} imageY - 이미지 Y 좌표
   * @returns {Object} 캔버스 좌표
   */
  imageToCanvasCoordinates(imageX, imageY) {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    const x =
      (imageX - this.imageData.width / 2 + this.transform.translateX) *
        this.transform.scale +
      centerX;
    const y =
      (imageY - this.imageData.height / 2 + this.transform.translateY) *
        this.transform.scale +
      centerY;

    return { x, y };
  }

  /**
   * 픽셀 값 읽기
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @returns {Object} 픽셀 정보
   */
  getPixelValue(x, y) {
    if (
      !this.originalImageData ||
      x < 0 ||
      y < 0 ||
      x >= this.originalImageData.width ||
      y >= this.originalImageData.height
    ) {
      return null;
    }

    const index = (y * this.originalImageData.width + x) * 4;
    const data = this.originalImageData.data;

    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      a: data[index + 3],
      gray: Math.round(
        0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]
      ),
    };
  }

  /**
   * 이미지 데이터 복사
   * @param {ImageData} imageData - 복사할 이미지 데이터
   * @returns {ImageData} 복사된 이미지 데이터
   */
  cloneImageData(imageData) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    return ctx.getImageData(0, 0, imageData.width, imageData.height);
  }

  /**
   * 이미지 초기화
   */
  reset() {
    this.transform = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
    };

    this.adjustments = {
      brightness: 0,
      contrast: 1,
      gamma: 1,
      window: null,
      level: null,
      invert: false,
    };

    if (this.originalImageData) {
      this.imageData = this.cloneImageData(this.originalImageData);
      this.render();
    }

    appState.setState("viewer.transform", { ...this.transform });
    appState.setState("viewer.adjustments", { ...this.adjustments });
  }

  /**
   * 이미지 내보내기
   * @param {string} format - 내보내기 형식 ('png', 'jpeg')
   * @param {number} quality - JPEG 품질 (0-1)
   * @returns {string} 데이터 URL
   */
  exportImage(format = "png", quality = 0.9) {
    if (!this.canvas) return null;

    if (format === "jpeg") {
      return this.canvas.toDataURL("image/jpeg", quality);
    } else {
      return this.canvas.toDataURL("image/png");
    }
  }

  /**
   * 스크린샷 캡처 (오버레이 포함)
   * @param {HTMLElement} container - 캡처할 컨테이너
   * @returns {Promise<string>} 캡처된 이미지 데이터 URL
   */
  async captureScreenshot(container) {
    try {
      // html2canvas 라이브러리가 있다면 사용
      if (window.html2canvas) {
        const canvas = await window.html2canvas(container);
        return canvas.toDataURL();
      } else {
        // 기본적으로 현재 캔버스만 캡처
        return this.exportImage();
      }
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "스크린샷 캡처",
      });
      return null;
    }
  }

  /**
   * 정리
   */
  cleanup() {
    this.canvas = null;
    this.context = null;
    this.imageData = null;
    this.originalImageData = null;
    this.histogram = null;

    this.transform = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
    };

    this.adjustments = {
      brightness: 0,
      contrast: 1,
      gamma: 1,
      window: null,
      level: null,
      invert: false,
    };
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
export const imageProcessor = new ImageProcessor();

// 개발 모드에서 전역 객체에 추가
if (typeof window !== "undefined" && window.ENV?.NODE_ENV === "development") {
  window.imageProcessor = imageProcessor;
}
