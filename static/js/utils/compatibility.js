/**
 * 브라우저 호환성 체크 및 폴백 유틸리티
 * static/js/utils/compatibility.js
 */

// 브라우저 기능 감지 클래스
class BrowserCompatibility {
  constructor() {
    this.features = {};
    this.checkAllFeatures();
  }

  /**
   * 모든 필수 기능 체크
   */
  checkAllFeatures() {
    this.features = {
      // 기본 JavaScript 기능들
      es6: this.checkES6Support(),
      modules: this.checkModuleSupport(),
      dynamicImport: this.checkDynamicImportSupport(),

      // Web APIs
      fetch: this.checkFetchSupport(),
      promise: this.checkPromiseSupport(),
      canvas: this.checkCanvasSupport(),
      fileAPI: this.checkFileAPISupport(),

      // DOM 기능들
      customElements: this.checkCustomElementsSupport(),
      shadowDOM: this.checkShadowDOMSupport(),

      // 네트워크 기능들
      webSockets: this.checkWebSocketSupport(),
      serviceWorker: this.checkServiceWorkerSupport(),

      // 저장소 기능들
      localStorage: this.checkLocalStorageSupport(),
      indexedDB: this.checkIndexedDBSupport(),
    };
  }

  /**
   * ES6 기본 기능 지원 체크
   */
  checkES6Support() {
    try {
      // Arrow functions
      new Function("() => {}");

      // const/let
      new Function("const x = 1; let y = 2;");

      // Template literals
      new Function("`template ${1} literal`");

      // Destructuring
      new Function("const {x} = {x: 1}");

      // Default parameters
      new Function("function test(x = 1) { return x; }");

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * ES6 모듈 지원 체크
   */
  checkModuleSupport() {
    try {
      // script type="module" 지원 체크
      if ("noModule" in document.createElement("script")) {
        return true;
      }

      // HTMLScriptElement.supports 메서드 체크
      if (
        "supports" in HTMLScriptElement &&
        typeof HTMLScriptElement.supports === "function"
      ) {
        return HTMLScriptElement.supports("module");
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * 동적 import 지원 체크
   */
  checkDynamicImportSupport() {
    try {
      // 안전한 동적 import 체크
      new Function('return import("data:text/javascript;base64,Cg==")');
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Fetch API 지원 체크
   */
  checkFetchSupport() {
    return typeof fetch !== "undefined";
  }

  /**
   * Promise 지원 체크
   */
  checkPromiseSupport() {
    return typeof Promise !== "undefined";
  }

  /**
   * Canvas 지원 체크
   */
  checkCanvasSupport() {
    try {
      const canvas = document.createElement("canvas");
      return !!(canvas.getContext && canvas.getContext("2d"));
    } catch (e) {
      return false;
    }
  }

  /**
   * File API 지원 체크
   */
  checkFileAPISupport() {
    return !!(window.File && window.FileReader && window.FormData);
  }

  /**
   * Custom Elements 지원 체크
   */
  checkCustomElementsSupport() {
    return "customElements" in window;
  }

  /**
   * Shadow DOM 지원 체크
   */
  checkShadowDOMSupport() {
    return "attachShadow" in Element.prototype;
  }

  /**
   * WebSocket 지원 체크
   */
  checkWebSocketSupport() {
    return "WebSocket" in window;
  }

  /**
   * Service Worker 지원 체크
   */
  checkServiceWorkerSupport() {
    return "serviceWorker" in navigator;
  }

  /**
   * localStorage 지원 체크
   */
  checkLocalStorageSupport() {
    try {
      const test = "test";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * IndexedDB 지원 체크
   */
  checkIndexedDBSupport() {
    return "indexedDB" in window;
  }

  /**
   * 특정 기능 지원 여부 확인
   */
  supports(feature) {
    return this.features[feature] || false;
  }

  /**
   * 여러 기능의 지원 여부 확인
   */
  supportsAll(features) {
    return features.every(feature => this.supports(feature));
  }

  /**
   * 브라우저 정보 가져오기
   */
  getBrowserInfo() {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    let version = "Unknown";

    if (ua.includes("Chrome/") && !ua.includes("Edg/")) {
      browser = "Chrome";
      version = ua.match(/Chrome\/(\d+)/)?.[1] || "Unknown";
    } else if (ua.includes("Firefox/")) {
      browser = "Firefox";
      version = ua.match(/Firefox\/(\d+)/)?.[1] || "Unknown";
    } else if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
      browser = "Safari";
      version = ua.match(/Version\/(\d+)/)?.[1] || "Unknown";
    } else if (ua.includes("Edg/")) {
      browser = "Edge";
      version = ua.match(/Edg\/(\d+)/)?.[1] || "Unknown";
    }

    return { browser, version, userAgent: ua };
  }

  /**
   * 호환성 등급 계산
   */
  getCompatibilityGrade() {
    const requiredFeatures = [
      "es6",
      "modules",
      "fetch",
      "promise",
      "canvas",
      "fileAPI",
    ];
    const optionalFeatures = [
      "dynamicImport",
      "customElements",
      "serviceWorker",
    ];

    const requiredScore = requiredFeatures.filter(f => this.supports(f)).length;
    const optionalScore = optionalFeatures.filter(f => this.supports(f)).length;

    const totalScore =
      (requiredScore / requiredFeatures.length) * 80 +
      (optionalScore / optionalFeatures.length) * 20;

    if (totalScore >= 90) return "A";
    if (totalScore >= 80) return "B";
    if (totalScore >= 70) return "C";
    if (totalScore >= 60) return "D";
    return "F";
  }

  /**
   * 상세 호환성 보고서 생성
   */
  generateReport() {
    const browserInfo = this.getBrowserInfo();
    const grade = this.getCompatibilityGrade();

    return {
      browser: browserInfo,
      grade: grade,
      features: { ...this.features },
      recommendations: this.getRecommendations(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 권장 사항 생성
   */
  getRecommendations() {
    const recommendations = [];

    if (!this.supports("es6")) {
      recommendations.push("ES6 지원을 위해 브라우저를 업데이트하세요.");
    }

    if (!this.supports("modules")) {
      recommendations.push("ES6 모듈 지원을 위해 최신 브라우저를 사용하세요.");
    }

    if (!this.supports("fetch")) {
      recommendations.push("Fetch API 지원을 위해 브라우저를 업데이트하세요.");
    }

    if (!this.supports("canvas")) {
      recommendations.push("Canvas 지원이 필요합니다. 브라우저를 확인하세요.");
    }

    if (!this.supports("fileAPI")) {
      recommendations.push("파일 API 지원을 위해 브라우저를 업데이트하세요.");
    }

    return recommendations;
  }
}

// 폴백 로더 클래스
class FallbackLoader {
  constructor() {
    this.compatibility = new BrowserCompatibility();
    this.loadStrategies = new Map();
    this.setupStrategies();
  }

  /**
   * 로드 전략 설정
   */
  setupStrategies() {
    // 모던 브라우저: ES6 모듈 사용
    this.loadStrategies.set("modern", {
      condition: () =>
        this.compatibility.supportsAll(["es6", "modules", "dynamicImport"]),
      loader: () => this.loadModernApp(),
    });

    // 중간 브라우저: ES6 지원하지만 모듈 미지원
    this.loadStrategies.set("intermediate", {
      condition: () =>
        this.compatibility.supportsAll(["es6", "fetch", "promise"]),
      loader: () => this.loadBundledApp(),
    });

    // 구형 브라우저: 기본 기능만
    this.loadStrategies.set("legacy", {
      condition: () => this.compatibility.supportsAll(["canvas", "fileAPI"]),
      loader: () => this.loadBasicApp(),
    });

    // 최악의 경우: 정적 페이지만
    this.loadStrategies.set("minimal", {
      condition: () => true,
      loader: () => this.showStaticPage(),
    });
  }

  /**
   * 적절한 전략 선택 및 앱 로드
   */
  async loadApp() {
    for (const [name, strategy] of this.loadStrategies) {
      if (strategy.condition()) {
        console.log(`Loading app with strategy: ${name}`);
        try {
          await strategy.loader();
          return;
        } catch (error) {
          console.error(`Strategy ${name} failed:`, error);
          continue;
        }
      }
    }

    throw new Error("No compatible loading strategy found");
  }

  /**
   * 모던 앱 로드 (ES6 모듈)
   */
  async loadModernApp() {
    const { default: app } = await import("./js/app.js");
    console.log("Modern app loaded successfully");
  }

  /**
   * 번들된 앱 로드 (ES6, 모듈 없음)
   */
  async loadBundledApp() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "./js/app.bundle.js"; // 번들된 버전
      script.onload = () => {
        console.log("Bundled app loaded successfully");
        resolve();
      };
      script.onerror = () => {
        reject(new Error("Failed to load bundled app"));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 기본 앱 로드 (ES5 호환)
   */
  async loadBasicApp() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "./js/app.es5.js"; // ES5 호환 버전
      script.onload = () => {
        console.log("Basic app loaded successfully");
        resolve();
      };
      script.onerror = () => {
        reject(new Error("Failed to load basic app"));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 정적 페이지 표시
   */
  showStaticPage() {
    document.body.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-50">
          <div class="text-center p-8 max-w-md">
            <div class="text-6xl mb-4">🏥</div>
            <h1 class="text-2xl font-bold text-gray-800 mb-4">DICOM 분석기</h1>
            <p class="text-gray-600 mb-6">
              죄송합니다. 현재 브라우저에서는 이 애플리케이션을 실행할 수 없습니다.
            </p>
            <div class="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
              <h3 class="font-bold text-yellow-800 mb-2">권장 브라우저</h3>
              <ul class="text-sm text-yellow-700 text-left list-disc list-inside">
                <li>Chrome 61+</li>
                <li>Firefox 60+</li>
                <li>Safari 11+</li>
                <li>Edge 79+</li>
              </ul>
            </div>
            <button onclick="location.reload()" 
                    class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
              다시 시도
            </button>
          </div>
        </div>
      `;
  }
}

// 전역 객체로 내보내기
window.BrowserCompatibility = BrowserCompatibility;
window.FallbackLoader = FallbackLoader;

// 즉시 사용 가능한 함수들
window.checkBrowserCompatibility = function () {
  return new BrowserCompatibility();
};

window.loadAppWithFallback = async function () {
  const loader = new FallbackLoader();
  return await loader.loadApp();
};

export { BrowserCompatibility, FallbackLoader };
