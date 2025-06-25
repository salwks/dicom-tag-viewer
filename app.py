import os
import mimetypes
from flask import Flask, request, jsonify, send_file
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


@app.route("/")
def index():
    """메인 페이지"""
    return app.send_static_file("index.html")


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
