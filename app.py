import os
import re
import mimetypes
from flask import (
    Flask,
    request,
    jsonify,
    send_file,
    send_from_directory,
    render_template_string,
)
from werkzeug.utils import secure_filename
from pydicom import dcmread
from pydicom.datadict import dictionary_description
from pydicom.errors import InvalidDicomError
from pydicom.pixel_data_handlers.util import apply_voi_lut
from typing import cast, BinaryIO, Dict, Any, List
from io import BytesIO
from PIL import Image
import numpy as np
import logging
import traceback

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder="static", static_url_path="")

# 설정
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {".dcm", ".dicom", ".dic"}
UPLOAD_FOLDER = "uploads"

# 업로드 폴더 생성
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# 브라우저 감지 클래스
class BrowserDetector:
    def __init__(self):
        self.patterns = {
            "chrome": r"Chrome/(\d+)",
            "firefox": r"Firefox/(\d+)",
            "safari": r"Version/(\d+).*Safari",
            "edge": r"Edg/(\d+)",
            "ie": r"MSIE (\d+)|Trident.*rv:(\d+)",
        }

        self.es6_support = {
            "chrome": 51,
            "firefox": 54,
            "safari": 10,
            "edge": 15,
            "ie": 0,  # IE는 ES6 모듈 미지원
        }

        self.module_support = {
            "chrome": 61,
            "firefox": 60,
            "safari": 11,
            "edge": 79,
            "ie": 0,
        }

    def detect_browser(self, user_agent):
        """User-Agent에서 브라우저 정보 추출"""
        for browser, pattern in self.patterns.items():
            match = re.search(pattern, user_agent)
            if match:
                version = int(match.group(1) or match.group(2) or 0)
                return {"name": browser, "version": version, "user_agent": user_agent}

        return {"name": "unknown", "version": 0, "user_agent": user_agent}

    def supports_es6(self, browser_info):
        """ES6 지원 여부 확인"""
        browser = browser_info["name"]
        version = browser_info["version"]

        if browser in self.es6_support:
            return version >= self.es6_support[browser]

        return False

    def supports_modules(self, browser_info):
        """ES6 모듈 지원 여부 확인"""
        browser = browser_info["name"]
        version = browser_info["version"]

        if browser in self.module_support:
            return version >= self.module_support[browser]

        return False

    def get_compatibility_level(self, browser_info):
        """브라우저 호환성 레벨 반환"""
        if self.supports_modules(browser_info):
            return "modern"
        elif self.supports_es6(browser_info):
            return "intermediate"
        else:
            return "legacy"


# 브라우저 감지기 인스턴스 생성
browser_detector = BrowserDetector()

# 적응형 HTML 템플릿들
TEMPLATES = {
    "modern": """
    <!doctype html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DICOM 분석기 - 의료영상 뷰어</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://d3js.org/d3.v6.min.js"></script>
        <style>
            .drag-over { background-color: rgba(59, 130, 246, 0.1); border: 2px dashed #3b82f6; }
            .loading-spinner { animation: spin 1s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        </style>
    </head>
    <body>
        <div id="app">{{ content | safe }}</div>
        
        <!-- ES6 모듈 로드 -->
        <script type="module">
            // 환경 설정
            window.ENV = { NODE_ENV: "production", API_URL: "", VERSION: "2.0.0" };
            
            try {
                const { default: app } = await import('./js/app.js');
                console.log('DICOM 분석기가 성공적으로 로드되었습니다.');
            } catch (error) {
                console.error('모듈 로드 실패:', error);
                // 폴백으로 레거시 버전 로드
                window.location.href = '/legacy';
            }
        </script>
        
        <!-- 폴백 -->
        <script nomodule>
            window.location.href = '/legacy';
        </script>
    </body>
    </html>
    """,
    "legacy": """
    <!doctype html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DICOM 분석기 - 기본 버전</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <!-- 폴리필 추가 -->
        <script src="https://polyfill.io/v3/polyfill.min.js?features=fetch,Promise,Array.prototype.includes"></script>
        <style>
            .drag-over { background-color: rgba(59, 130, 246, 0.1); border: 2px dashed #3b82f6; }
            .loading-spinner { animation: spin 1s linear infinite; }
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        </style>
    </head>
    <body>
        <!-- 브라우저 업데이트 알림 -->
        <div id="browser-notice" style="
            position: fixed; top: 0; left: 0; right: 0; 
            background: #fbbf24; color: #92400e; padding: 8px; 
            text-align: center; font-size: 14px; z-index: 9999;
        ">
            ⚠️ 구형 브라우저가 감지되었습니다. 모든 기능을 사용하려면 브라우저를 업데이트해주세요.
            <button onclick="document.getElementById('browser-notice').style.display='none'" 
                    style="margin-left: 10px; background: none; border: 1px solid; padding: 2px 8px;">닫기</button>
        </div>
        
        <div id="app" style="padding-top: 40px;">{{ content | safe }}</div>
        
        <!-- ES5 호환 기본 스크립트 -->
        <script>
            (function() {
                'use strict';
                
                // 기본 상태 관리
                var state = {
                    currentFile: null,
                    isLoading: false
                };
                
                // 기본 파일 선택 기능
                function setupBasicFileUpload() {
                    var fileInput = document.getElementById('fileInput');
                    var btnSelectFile = document.getElementById('btnSelectFile');
                    var btnSelectFileWelcome = document.getElementById('btnSelectFileWelcome');
                    
                    function selectFile() {
                        if (fileInput) fileInput.click();
                    }
                    
                    if (btnSelectFile) {
                        btnSelectFile.addEventListener('click', selectFile);
                    }
                    if (btnSelectFileWelcome) {
                        btnSelectFileWelcome.addEventListener('click', selectFile);
                    }
                    
                    if (fileInput) {
                        fileInput.addEventListener('change', function(e) {
                            var file = e.target.files[0];
                            if (file) {
                                handleFileSelected(file);
                            }
                        });
                    }
                }
                
                function handleFileSelected(file) {
                    if (!file) return;
                    
                    // 기본 파일 검증
                    var allowedExtensions = ['.dcm', '.dicom', '.dic'];
                    var fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                    
                    if (fileExtension && allowedExtensions.indexOf(fileExtension) === -1) {
                        alert('지원하지 않는 파일 형식입니다. .dcm, .dicom, .dic 파일만 지원됩니다.');
                        return;
                    }
                    
                    if (file.size > 100 * 1024 * 1024) {
                        alert('파일 크기가 너무 큽니다. 100MB 이하의 파일을 선택해주세요.');
                        return;
                    }
                    
                    // 파일 정보 표시
                    var fileInfo = document.getElementById('fileInfo');
                    var fileName = document.getElementById('fileName');
                    var fileSize = document.getElementById('fileSize');
                    
                    if (fileName) fileName.textContent = file.name;
                    if (fileSize) fileSize.textContent = '(' + formatFileSize(file.size) + ')';
                    if (fileInfo) fileInfo.classList.remove('hidden');
                    
                    // 업로드 버튼 활성화
                    var btnUpload = document.getElementById('btnUpload');
                    if (btnUpload) {
                        btnUpload.disabled = false;
                        btnUpload.classList.remove('opacity-50', 'cursor-not-allowed');
                        btnUpload.addEventListener('click', function() {
                            uploadFile(file);
                        });
                    }
                    
                    state.currentFile = file;
                }
                
                function formatFileSize(bytes) {
                    if (bytes === 0) return '0 Bytes';
                    var k = 1024;
                    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    var i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                }
                
                function uploadFile(file) {
                    if (state.isLoading) return;
                    
                    state.isLoading = true;
                    
                    // 로딩 표시
                    var loadingIndicator = document.getElementById('loadingIndicator');
                    if (loadingIndicator) {
                        loadingIndicator.classList.remove('hidden');
                    }
                    
                    // FormData 생성
                    var formData = new FormData();
                    formData.append('file', file);
                    
                    // XMLHttpRequest 사용 (fetch 대신)
                    var xhr = new XMLHttpRequest();
                    
                    xhr.onreadystatechange = function() {
                        if (xhr.readyState === 4) {
                            state.isLoading = false;
                            
                            if (loadingIndicator) {
                                loadingIndicator.classList.add('hidden');
                            }
                            
                            if (xhr.status === 200) {
                                try {
                                    var response = JSON.parse(xhr.responseText);
                                    handleUploadSuccess(response);
                                } catch (e) {
                                    handleUploadError('서버 응답을 파싱할 수 없습니다.');
                                }
                            } else {
                                handleUploadError('업로드 실패: ' + xhr.status);
                            }
                        }
                    };
                    
                    xhr.onerror = function() {
                        state.isLoading = false;
                        if (loadingIndicator) {
                            loadingIndicator.classList.add('hidden');
                        }
                        handleUploadError('네트워크 오류가 발생했습니다.');
                    };
                    
                    xhr.open('POST', '/upload');
                    xhr.send(formData);
                }
                
                function handleUploadSuccess(response) {
                    alert('DICOM 파일 업로드가 완료되었습니다!\\n\\n' + 
                          '현재 브라우저에서는 기본 기능만 제공됩니다.\\n' +
                          '전체 기능을 사용하려면 최신 브라우저를 사용해주세요.');
                }
                
                function handleUploadError(message) {
                    alert('오류: ' + message);
                }
                
                // 초기화
                function init() {
                    console.log('DICOM 뷰어 기본 모드로 시작됩니다.');
                    setupBasicFileUpload();
                }
                
                // DOM 로드 완료 시 초기화
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', init);
                } else {
                    init();
                }
            })();
        </script>
    </body>
    </html>
    """,
}

# 기본 콘텐츠
DEFAULT_CONTENT = """
<div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="text-center p-8">
        <div class="text-8xl mb-6">🏥</div>
        <h1 class="text-4xl font-bold text-gray-800 mb-4">DICOM 분석기</h1>
        <p class="text-xl text-gray-600 mb-8">의료영상 파일을 분석하고 측정하세요</p>
        
        <div class="space-y-4 max-w-md mx-auto">
            <input type="file" id="fileInput" accept=".dcm,.dicom,.dic" class="hidden">
            <button id="btnSelectFileWelcome" onclick="document.getElementById('fileInput').click()" 
                    class="w-full bg-blue-500 text-white py-3 px-6 rounded-lg text-lg hover:bg-blue-600 transition-colors">
                파일 선택하기
            </button>
            <div class="text-sm text-gray-500">
                DICOM 파일(.dcm, .dicom, .dic)을 지원합니다
            </div>
        </div>
        
        <!-- 파일 정보 -->
        <div id="fileInfo" class="text-sm text-gray-600 hidden mt-4">
            <span id="fileName" class="font-medium"></span>
            <span id="fileSize" class="text-gray-500"></span>
        </div>
        
        <!-- 업로드 버튼 -->
        <button id="btnUpload" disabled
                class="mt-4 bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 transition-colors opacity-50 cursor-not-allowed">
            분석 시작
        </button>
        
        <!-- 로딩 인디케이터 -->
        <div id="loadingIndicator" class="hidden flex items-center justify-center space-x-2 mt-4">
            <div class="loading-spinner w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span class="text-sm text-gray-600">처리 중...</span>
        </div>
    </div>
</div>
"""


class DicomProcessor:
    """DICOM 파일 처리를 담당하는 클래스"""

    @staticmethod
    def validate_dicom_file(file) -> tuple[bool, str]:
        """DICOM 파일 유효성 검사"""
        try:
            # 파일 크기 검사
            file.seek(0, 2)  # 파일 끝으로 이동
            size = file.tell()
            file.seek(0)  # 시작으로 다시 이동

            if size > MAX_FILE_SIZE:
                return (
                    False,
                    f"파일 크기가 너무 큽니다. 최대 {MAX_FILE_SIZE // (1024*1024)}MB까지 허용됩니다.",
                )

            if size < 128:  # DICOM 헤더 최소 크기
                return (
                    False,
                    "파일이 너무 작습니다. 유효한 DICOM 파일이 아닐 수 있습니다.",
                )

            # DICOM 파일 시그니처 검사 (preamble + DICM)
            preamble = file.read(128)
            dicm = file.read(4)
            file.seek(0)

            if dicm != b"DICM":
                # DICM이 없어도 유효한 DICOM일 수 있으므로 pydicom으로 한 번 더 검사
                try:
                    dcmread(cast(BinaryIO, file), force=True)
                    file.seek(0)
                    return True, "유효한 DICOM 파일입니다."
                except Exception:
                    return False, "DICOM 파일 형식이 아닙니다."

            return True, "유효한 DICOM 파일입니다."

        except Exception as e:
            logger.error(f"파일 검증 중 오류: {str(e)}")
            return False, "파일 검증 중 오류가 발생했습니다."

    @staticmethod
    def parse_dicom(file) -> tuple[Dict[str, Any], str]:
        """DICOM 파일 파싱"""
        try:
            dicom_data = dcmread(cast(BinaryIO, file), force=True)

            # 프리앰블 처리
            preamble_raw = getattr(dicom_data, "preamble", None)
            if preamble_raw and preamble_raw != b"\x00" * 128:
                try:
                    preamble = preamble_raw.decode("ascii", errors="ignore")
                except Exception:
                    preamble = preamble_raw.hex()
            else:
                preamble = "표준 DICOM 프리앰블"

            preamble = preamble[:50] + "..." if len(preamble) > 50 else preamble

            # DICOM 접두사
            dicom_prefix = str(dicom_data.file_meta.get("00020010", "DICOM 표준"))
            dicom_prefix = (
                dicom_prefix[:50] + "..." if len(dicom_prefix) > 50 else dicom_prefix
            )

            # 데이터 구조화
            dicom_dict = DicomProcessor._dicom_to_dict(dicom_data)

            result = {
                "preamble": preamble,
                "dicom_prefix": dicom_prefix,
                "dicom_data": dicom_dict,
                "patient_info": DicomProcessor._extract_patient_info(dicom_data),
                "study_info": DicomProcessor._extract_study_info(dicom_data),
                "image_info": DicomProcessor._extract_image_info(dicom_data),
            }

            return result, "파싱 성공"

        except InvalidDicomError:
            return {}, "유효하지 않은 DICOM 파일입니다."
        except Exception as e:
            logger.error(f"DICOM 파싱 오류: {str(e)}\n{traceback.format_exc()}")
            return {}, f"DICOM 파일 처리 중 오류가 발생했습니다: {str(e)}"

    @staticmethod
    def _dicom_to_dict(dataset) -> Dict[str, Any]:
        """DICOM 데이터셋을 딕셔너리로 변환"""
        result = {
            "name": "DICOM Information",
            "children": [
                {"name": "File Meta Information", "children": []},
                {"name": "Patient Information", "children": []},
                {"name": "Study Information", "children": []},
                {"name": "Series Information", "children": []},
                {"name": "Image Information", "children": []},
                {"name": "Pixel Data", "children": []},
            ],
        }

        group_mapping = {
            "0002": 0,
            "0008": 2,
            "0010": 1,
            "0018": 4,
            "0020": 2,
            "0021": 3,
            "0028": 4,
            "7FE0": 5,
        }

        for elem in dataset:
            if not hasattr(elem, "tag"):
                continue

            group_number = f"{elem.tag.group:04X}"
            tag_id = str(elem.tag)
            vr = getattr(elem, "VR", "Unknown")
            vm = getattr(elem, "VM", "Unknown")

            try:
                value_field = str(elem.value)
                value_length = len(value_field)
            except Exception as e:
                value_field = f"[읽기 오류: {str(e)}]"
                value_length = 0

            # 개인정보 마스킹
            if elem.tag.group == 0x0010:  # Patient 그룹
                if elem.tag.element in [0x0010, 0x0020]:  # Patient Name, ID
                    value_field = "[개인정보 보호됨]"

            if elem.tag.is_private:
                description = "Private Tag"
            else:
                try:
                    description = dictionary_description(elem.tag)
                except KeyError:
                    description = "설명 없음"

            tag_info = {
                "tag_id": tag_id,
                "description": description,
                "vr": vr,
                "vm": vm,
                "value_length": value_length,
                "value_field": value_field,
                "is_private": elem.tag.is_private,
            }

            group_index = group_mapping.get(group_number, 4)
            result["children"][group_index]["children"].append(tag_info)

        return result

    @staticmethod
    def _extract_patient_info(dataset) -> Dict[str, str]:
        """환자 정보 추출 (개인정보 보호)"""
        return {
            "age": str(getattr(dataset, "PatientAge", "N/A")),
            "sex": str(getattr(dataset, "PatientSex", "N/A")),
            "birth_date": "[보호됨]",
            "patient_id": "[보호됨]",
        }

    @staticmethod
    def _extract_study_info(dataset) -> Dict[str, str]:
        """검사 정보 추출"""
        return {
            "study_date": str(getattr(dataset, "StudyDate", "N/A")),
            "study_time": str(getattr(dataset, "StudyTime", "N/A")),
            "modality": str(getattr(dataset, "Modality", "N/A")),
            "study_description": str(getattr(dataset, "StudyDescription", "N/A")),
        }

    @staticmethod
    def _extract_image_info(dataset) -> Dict[str, str]:
        """이미지 정보 추출"""
        return {
            "rows": str(getattr(dataset, "Rows", "N/A")),
            "columns": str(getattr(dataset, "Columns", "N/A")),
            "bits_allocated": str(getattr(dataset, "BitsAllocated", "N/A")),
            "pixel_spacing": str(getattr(dataset, "PixelSpacing", "N/A")),
        }

    @staticmethod
    def generate_preview_image(file) -> tuple[BytesIO, str]:
        """DICOM 이미지 미리보기 생성"""
        try:
            dicom_data = dcmread(cast(BinaryIO, file), force=True)

            if not hasattr(dicom_data, "pixel_array"):
                return None, "이미지 데이터가 없습니다."

            pixel_array = dicom_data.pixel_array

            # VOI LUT 적용 (Window/Level)
            if (
                hasattr(dicom_data, "VOILUTFunction")
                or hasattr(dicom_data, "WindowCenter")
                or hasattr(dicom_data, "WindowWidth")
            ):
                try:
                    pixel_array = apply_voi_lut(pixel_array, dicom_data)
                except Exception as e:
                    logger.warning(f"VOI LUT 적용 실패, 기본 정규화 사용: {str(e)}")

            # 정규화
            pixel_array = pixel_array.astype(float)
            pixel_min, pixel_max = np.min(pixel_array), np.max(pixel_array)

            if pixel_max > pixel_min:
                pixel_array = (
                    (pixel_array - pixel_min) / (pixel_max - pixel_min) * 255.0
                )
            else:
                pixel_array = np.zeros_like(pixel_array)

            # PIL 이미지로 변환
            image = Image.fromarray(pixel_array.astype(np.uint8))

            # 그레이스케일이 아닌 경우 변환
            if image.mode != "L":
                image = image.convert("L")

            buffer = BytesIO()
            image.save(buffer, format="PNG", optimize=True)
            buffer.seek(0)

            return buffer, "미리보기 생성 성공"

        except Exception as e:
            logger.error(f"미리보기 생성 오류: {str(e)}\n{traceback.format_exc()}")
            return None, f"미리보기 생성 실패: {str(e)}"


# 브라우저별 라우트
@app.route("/")
def index():
    """브라우저에 따른 적응형 메인 페이지"""
    user_agent = request.headers.get("User-Agent", "")
    browser_info = browser_detector.detect_browser(user_agent)
    compatibility_level = browser_detector.get_compatibility_level(browser_info)

    # 로깅
    logger.info(
        f"Browser detected: {browser_info['name']} {browser_info['version']}, "
        f"Compatibility: {compatibility_level}"
    )

    # 적절한 템플릿 선택 (레거시를 기본으로)
    if compatibility_level == "modern":
        template = TEMPLATES["modern"]
    else:
        template = TEMPLATES["legacy"]

    return render_template_string(template, content=DEFAULT_CONTENT)


@app.route("/modern")
def modern_version():
    """모던 브라우저용 강제 버전"""
    return render_template_string(TEMPLATES["modern"], content=DEFAULT_CONTENT)


@app.route("/legacy")
def legacy_version():
    """구형 브라우저용 강제 버전"""
    return render_template_string(TEMPLATES["legacy"], content=DEFAULT_CONTENT)


@app.route("/compatibility-check")
def compatibility_check():
    """브라우저 호환성 체크 API"""
    user_agent = request.headers.get("User-Agent", "")
    browser_info = browser_detector.detect_browser(user_agent)

    return jsonify(
        {
            "browser": browser_info,
            "supports_es6": browser_detector.supports_es6(browser_info),
            "supports_modules": browser_detector.supports_modules(browser_info),
            "compatibility_level": browser_detector.get_compatibility_level(
                browser_info
            ),
            "recommendations": get_browser_recommendations(browser_info),
        }
    )


def get_browser_recommendations(browser_info):
    """브라우저별 권장사항 반환"""
    browser = browser_info["name"]
    version = browser_info["version"]

    recommendations = []

    if browser == "ie":
        recommendations.append(
            "Internet Explorer는 지원되지 않습니다. Chrome, Firefox, Safari, Edge를 사용해주세요."
        )
    elif browser == "chrome" and version < 61:
        recommendations.append("Chrome을 최신 버전으로 업데이트해주세요.")
    elif browser == "firefox" and version < 60:
        recommendations.append("Firefox를 최신 버전으로 업데이트해주세요.")
    elif browser == "safari" and version < 11:
        recommendations.append("Safari를 최신 버전으로 업데이트해주세요.")
    elif browser == "edge" and version < 79:
        recommendations.append("Edge를 최신 버전으로 업데이트해주세요.")
    elif browser == "unknown":
        recommendations.append(
            "브라우저를 확인할 수 없습니다. Chrome, Firefox, Safari, Edge 사용을 권장합니다."
        )

    if not recommendations:
        recommendations.append("브라우저가 모든 기능을 지원합니다.")

    return recommendations


@app.route("/upload", methods=["POST"])
def upload_dicom():
    """DICOM 파일 업로드 및 파싱"""
    try:
        # 파일 존재 확인
        if "file" not in request.files:
            return jsonify({"error": "파일이 전송되지 않았습니다."}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "파일이 선택되지 않았습니다."}), 400

        # 파일 이름 보안 처리
        filename = secure_filename(file.filename)
        if not filename:
            return jsonify({"error": "유효하지 않은 파일 이름입니다."}), 400

        # 파일 확장자 검사
        file_ext = os.path.splitext(filename)[1].lower()
        if file_ext and file_ext not in ALLOWED_EXTENSIONS:
            return (
                jsonify(
                    {
                        "error": f"지원하지 않는 파일 형식입니다. 허용되는 확장자: {', '.join(ALLOWED_EXTENSIONS)}"
                    }
                ),
                400,
            )

        # DICOM 파일 유효성 검사
        is_valid, message = DicomProcessor.validate_dicom_file(file)
        if not is_valid:
            return jsonify({"error": message}), 400

        # DICOM 파일 파싱
        result, parse_message = DicomProcessor.parse_dicom(file)
        if not result:
            return jsonify({"error": parse_message}), 400

        logger.info(f"DICOM 파일 업로드 성공: {filename}")
        return jsonify({"message": "업로드 성공", "filename": filename, **result})

    except Exception as e:
        logger.error(
            f"업로드 처리 중 예상치 못한 오류: {str(e)}\n{traceback.format_exc()}"
        )
        return jsonify({"error": "서버 내부 오류가 발생했습니다."}), 500


@app.route("/preview", methods=["POST"])
def preview_image():
    """DICOM 이미지 미리보기 생성"""
    try:
        if "file" not in request.files:
            return jsonify({"error": "파일이 전송되지 않았습니다."}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "파일이 선택되지 않았습니다."}), 400

        # 미리보기 이미지 생성
        buffer, message = DicomProcessor.generate_preview_image(file)
        if buffer is None:
            return jsonify({"error": message}), 400

        return send_file(buffer, mimetype="image/png", as_attachment=False)

    except Exception as e:
        logger.error(
            f"미리보기 생성 중 예상치 못한 오류: {str(e)}\n{traceback.format_exc()}"
        )
        return jsonify({"error": "미리보기 생성 중 오류가 발생했습니다."}), 500


@app.route("/health", methods=["GET"])
def health_check():
    """서버 상태 확인"""
    return jsonify(
        {
            "status": "healthy",
            "max_file_size": MAX_FILE_SIZE,
            "allowed_extensions": list(ALLOWED_EXTENSIONS),
        }
    )


# 정적 파일 라우팅 (브라우저별)
@app.route("/static/dist/<path:filename>")
def serve_dist_files(filename):
    """브라우저별 빌드 파일 제공"""
    user_agent = request.headers.get("User-Agent", "")
    browser_info = browser_detector.detect_browser(user_agent)
    compatibility_level = browser_detector.get_compatibility_level(browser_info)

    # 적절한 빌드 디렉토리에서 파일 제공
    if compatibility_level == "modern":
        dist_path = os.path.join("static", "dist", "modern")
    else:
        dist_path = os.path.join("static", "dist", "legacy")

    try:
        return send_from_directory(dist_path, filename)
    except FileNotFoundError:
        # 파일이 없으면 기본 static 폴더에서 찾기
        return send_from_directory("static", filename)


# Content Security Policy 헤더 추가
@app.after_request
def add_security_headers(response):
    """보안 헤더 추가"""
    user_agent = request.headers.get("User-Agent", "")
    browser_info = browser_detector.detect_browser(user_agent)

    # 모던 브라우저에는 더 엄격한 CSP 적용
    if browser_detector.supports_modules(browser_info):
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://d3js.org; "
            "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self';"
        )
    else:
        # 구형 브라우저에는 덜 엄격한 CSP 적용
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://d3js.org https://polyfill.io; "
            "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; "
            "img-src 'self' data: blob:; "
            "connect-src 'self';"
        )

    # 기본 보안 헤더들
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    return response


@app.errorhandler(413)
def request_entity_too_large(error):
    return (
        jsonify(
            {
                "error": f"파일이 너무 큽니다. 최대 {MAX_FILE_SIZE // (1024*1024)}MB까지 허용됩니다."
            }
        ),
        413,
    )


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "요청한 리소스를 찾을 수 없습니다."}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "서버 내부 오류가 발생했습니다."}), 500


if __name__ == "__main__":
    # 개발 모드에서만 debug=True
    debug_mode = os.environ.get("FLASK_ENV") == "development"
    app.run(debug=debug_mode, host="0.0.0.0", port=8080)
