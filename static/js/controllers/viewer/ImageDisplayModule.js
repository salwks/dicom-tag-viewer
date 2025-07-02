/**
 * controllers/viewer/ImageDisplayModule.js
 * 이미지 표시 및 렌더링 담당 모듈
 */

import { appState } from "../../core/appStateManager.js";
import { errorHandler } from "../../core/errorHandler.js";

export class ImageDisplayModule {
  constructor() {
    this.baseController = null;
    this.imageData = null;
    this.originalImageData = null;

    // 변환 상태
    this.transform = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
    };

    // 이미지 조정 상태
    this.adjustments = {
      brightness: 0,
      contrast: 100,
      gamma: 1,
      invert: false,
    };

    this.isEnabled = true;

    // 무한 재귀 방지 플래그들
    this._isLoadingImage = false;
    this._stateSubscribed = false;
    this._lastImageUrl = null;
  }

  /**
   * 베이스 컨트롤러 설정
   */
  setBaseController(baseController) {
    this.baseController = baseController;
    this.setupEventListeners();
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 앱 상태 구독 (한 번만 설정)
    if (!this._stateSubscribed) {
      appState.subscribe("previewImageUrl", imageUrl => {
        if (imageUrl && this.baseController?.state.isActive && this.isEnabled) {
          this.loadImage(imageUrl);
        }
      });
      this._stateSubscribed = true;
    }
  }

  /**
   * 이미지 로드
   */
  async loadImage(imageUrl) {
    // 이미 같은 이미지를 로드 중이거나 로드했으면 중단
    if (this._isLoadingImage || this._lastImageUrl === imageUrl) {
      console.log("이미지 로드 중복 방지:", imageUrl);
      return;
    }

    this._isLoadingImage = true;
    this._lastImageUrl = imageUrl;

    try {
      console.log("이미지 로드 시작:", imageUrl);

      const img = new Image();
      img.crossOrigin = "anonymous";

      const imageData = await new Promise((resolve, reject) => {
        img.onload = () => {
          const data = {
            image: img,
            width: img.width,
            height: img.height,
            aspectRatio: img.width / img.height,
          };
          resolve(data);
        };
        img.onerror = () => reject(new Error("이미지 로드 실패"));
        img.src = imageUrl;
      });

      this.imageData = imageData;
      this.originalImageData = { ...imageData };

      // 베이스 컨트롤러에 이미지 데이터 전달 (한 번만)
      if (this.baseController && !this.baseController.state.imageData) {
        await this.baseController.loadImageData(imageData);
      }

      // 초기 변환 설정
      this.resetTransform();

      console.log("이미지 로드 완료:", imageData);
    } catch (error) {
      await errorHandler.handleError(error, {
        context: "이미지 로드",
      });
    } finally {
      // 로드 완료 후 플래그 해제
      setTimeout(() => {
        this._isLoadingImage = false;
      }, 500);
    }
  }

  /**
   * 이미지 렌더링
   */
  render() {
    if (!this.isEnabled || !this.imageData || !this.baseController) return;

    const ctx = this.baseController.canvases.imageCtx;
    if (!ctx) return;

    // 캔버스 클리어
    this.baseController.clearCanvas("image");

    // 변환 매트릭스 적용
    ctx.save();

    // 캔버스 중심으로 이동
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;

    ctx.translate(centerX, centerY);
    ctx.scale(this.transform.scale, this.transform.scale);
    ctx.rotate((this.transform.rotation * Math.PI) / 180);
    ctx.translate(this.transform.translateX, this.transform.translateY);
    ctx.translate(-this.imageData.width / 2, -this.imageData.height / 2);

    // 이미지 그리기
    this.drawProcessedImage(ctx);

    ctx.restore();

    // 상태 업데이트
    this.updateDisplayInfo();
  }

  /**
   * 처리된 이미지 그리기
   */
  drawProcessedImage(ctx) {
    if (this.needsImageProcessing()) {
      // 이미지 처리가 필요한 경우
      this.drawAdjustedImage(ctx);
    } else {
      // 원본 이미지 그리기
      ctx.drawImage(this.imageData.image, 0, 0);
    }
  }

  /**
   * 조정된 이미지 그리기
   */
  drawAdjustedImage(ctx) {
    // 임시 캔버스에서 이미지 처리
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");

    tempCanvas.width = this.imageData.width;
    tempCanvas.height = this.imageData.height;

    // 원본 이미지 그리기
    tempCtx.drawImage(this.imageData.image, 0, 0);

    // 이미지 데이터 가져오기
    const imageData = tempCtx.getImageData(
      0,
      0,
      tempCanvas.width,
      tempCanvas.height
    );
    const data = imageData.data;

    // 픽셀별 조정 적용
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 밝기 조정
      r += this.adjustments.brightness * 2.55;
      g += this.adjustments.brightness * 2.55;
      b += this.adjustments.brightness * 2.55;

      // 대비 조정
      const contrastFactor = this.adjustments.contrast / 100;
      r = (r - 128) * contrastFactor + 128;
      g = (g - 128) * contrastFactor + 128;
      b = (b - 128) * contrastFactor + 128;

      // 감마 보정
      if (this.adjustments.gamma !== 1) {
        r = 255 * Math.pow(r / 255, 1 / this.adjustments.gamma);
        g = 255 * Math.pow(g / 255, 1 / this.adjustments.gamma);
        b = 255 * Math.pow(b / 255, 1 / this.adjustments.gamma);
      }

      // 반전
      if (this.adjustments.invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      // 클램핑
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    // 처리된 이미지 데이터 적용
    tempCtx.putImageData(imageData, 0, 0);

    // 메인 캔버스에 그리기
    ctx.drawImage(tempCanvas, 0, 0);
  }

  /**
   * 이미지 처리 필요 여부 확인
   */
  needsImageProcessing() {
    return (
      this.adjustments.brightness !== 0 ||
      this.adjustments.contrast !== 100 ||
      this.adjustments.gamma !== 1 ||
      this.adjustments.invert
    );
  }

  /**
   * 변환 적용
   */
  applyTransform(newTransform) {
    Object.assign(this.transform, newTransform);
    this.render();

    // 상태 저장
    appState.setState("viewer.transform", { ...this.transform });
  }

  /**
   * 이미지 조정 적용
   */
  applyAdjustments(newAdjustments) {
    Object.assign(this.adjustments, newAdjustments);
    this.render();

    // 상태 저장
    appState.setState("viewer.adjustments", { ...this.adjustments });
  }

  /**
   * 변환 초기화
   */
  resetTransform() {
    this.transform = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      rotation: 0,
    };
    this.render();
  }

  /**
   * 이미지 조정 초기화
   */
  resetAdjustments() {
    this.adjustments = {
      brightness: 0,
      contrast: 100,
      gamma: 1,
      invert: false,
    };
    this.render();
  }

  /**
   * 화면에 맞춤
   */
  fitToCanvas() {
    if (!this.imageData || !this.baseController) return;

    const canvas = this.baseController.canvases.image;
    const scaleX = canvas.width / this.imageData.width;
    const scaleY = canvas.height / this.imageData.height;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 여유 공간

    this.applyTransform({
      scale: scale,
      translateX: 0,
      translateY: 0,
      rotation: 0,
    });
  }

  /**
   * 좌표 변환: 캔버스 -> 이미지
   */
  canvasToImageCoords(canvasX, canvasY) {
    if (!this.imageData || !this.baseController) return { x: 0, y: 0 };

    const canvas = this.baseController.canvases.image;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // 역변환 계산
    const imageX =
      (canvasX - centerX) / this.transform.scale -
      this.transform.translateX +
      this.imageData.width / 2;
    const imageY =
      (canvasY - centerY) / this.transform.scale -
      this.transform.translateY +
      this.imageData.height / 2;

    return {
      x: Math.round(Math.max(0, Math.min(this.imageData.width - 1, imageX))),
      y: Math.round(Math.max(0, Math.min(this.imageData.height - 1, imageY))),
      imageX: Math.round(imageX),
      imageY: Math.round(imageY),
    };
  }

  /**
   * 좌표 변환: 이미지 -> 캔버스
   */
  imageToCanvasCoords(imageX, imageY) {
    if (!this.imageData || !this.baseController) return { x: 0, y: 0 };

    const canvas = this.baseController.canvases.image;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

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
   * 표시 정보 업데이트
   */
  updateDisplayInfo() {
    // 줌 인디케이터 업데이트
    const zoomIndicator = this.baseController?.elements.zoomIndicator;
    if (zoomIndicator) {
      const percentage = Math.round(this.transform.scale * 100);
      zoomIndicator.textContent = `${percentage}%`;
    }

    // 상태 업데이트
    appState.setState("viewer.displayInfo", {
      scale: this.transform.scale,
      position: {
        x: this.transform.translateX,
        y: this.transform.translateY,
      },
      imageSize: this.imageData
        ? {
            width: this.imageData.width,
            height: this.imageData.height,
          }
        : null,
    });
  }

  /**
   * 모듈 이벤트 핸들러
   */
  onActivate() {
    this.isEnabled = true;

    // 활성화 시 미리보기 이미지가 있는지 확인
    const imageUrl = appState.getState("previewImageUrl");
    if (imageUrl) {
      this.loadImage(imageUrl);
    }

    if (this.imageData) {
      this.render();
    }
  }

  onDeactivate() {
    this.isEnabled = false;
  }

  onImageLoaded(imageData) {
    // 베이스 컨트롤러에서 전달된 이미지 데이터
    console.log("ImageDisplayModule - 이미지 로드됨:", imageData);
    if (this.isEnabled) {
      this.render();
    }
  }

  onCanvasResize(size) {
    if (this.imageData && this.isEnabled) {
      this.render();
    }
  }

  /**
   * 현재 상태 가져오기
   */
  getState() {
    return {
      imageLoaded: !!this.imageData,
      transform: { ...this.transform },
      adjustments: { ...this.adjustments },
      imageSize: this.imageData
        ? {
            width: this.imageData.width,
            height: this.imageData.height,
          }
        : null,
    };
  }

  /**
   * 정리
   */
  cleanup() {
    this.imageData = null;
    this.originalImageData = null;
    this.resetTransform();
    this.resetAdjustments();
    this.isEnabled = false;

    console.log("ImageDisplayModule 정리 완료");
  }
}

export default ImageDisplayModule;
