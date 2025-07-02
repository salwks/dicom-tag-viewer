/**
 * controllers/viewer/index.js
 * 뷰어 모듈들의 통합 진입점
 */

// 모든 뷰어 모듈들을 export
export { default as BaseViewerController } from "./BaseViewerController.js";
export { default as ImageDisplayModule } from "./ImageDisplayModule.js";
export { default as InteractionModule } from "./InteractionModule.js";
export { default as MeasurementModule } from "./MeasurementModule.js";
export { default as ControlsModule } from "./ControlsModule.js";
export { default as ModularViewerController } from "./ModularViewerController.js";

// 간편한 팩토리 함수들
export const createViewerController = async () => {
  const { default: ModularViewerController } = await import(
    "./ModularViewerController.js"
  );
  return new ModularViewerController();
};

export const createImageDisplayModule = async () => {
  const { default: ImageDisplayModule } = await import(
    "./ImageDisplayModule.js"
  );
  return new ImageDisplayModule();
};

export const createInteractionModule = async () => {
  const { default: InteractionModule } = await import("./InteractionModule.js");
  return new InteractionModule();
};

export const createMeasurementModule = async () => {
  const { default: MeasurementModule } = await import("./MeasurementModule.js");
  return new MeasurementModule();
};

export const createControlsModule = async () => {
  const { default: ControlsModule } = await import("./ControlsModule.js");
  return new ControlsModule();
};

// 모듈 정보
export const moduleInfo = {
  BaseViewerController: {
    description: "뷰어의 기본 기능과 다른 모듈들을 관리하는 베이스 컨트롤러",
    dependencies: [],
  },
  ImageDisplayModule: {
    description: "이미지 표시, 변환, 조정을 담당하는 모듈",
    dependencies: ["BaseViewerController"],
  },
  InteractionModule: {
    description: "마우스/키보드 상호작용을 처리하는 모듈",
    dependencies: ["BaseViewerController", "ImageDisplayModule"],
  },
  MeasurementModule: {
    description: "거리, 각도, 면적 측정 기능을 제공하는 모듈",
    dependencies: ["BaseViewerController", "ImageDisplayModule"],
  },
  ControlsModule: {
    description: "UI 컨트롤과 설정을 관리하는 모듈",
    dependencies: [
      "BaseViewerController",
      "ImageDisplayModule",
      "InteractionModule",
    ],
  },
  ModularViewerController: {
    description: "모든 뷰어 모듈을 통합 관리하는 메인 컨트롤러",
    dependencies: ["All modules"],
  },
};

// 모듈 버전 정보
export const version = "2.0.0";
export const buildDate = new Date().toISOString();

console.log(`🧩 뷰어 모듈 시스템 v${version} 로드됨`);
console.log("📦 사용 가능한 모듈들:", Object.keys(moduleInfo));
