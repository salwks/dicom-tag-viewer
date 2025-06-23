from flask import Flask, request, jsonify, send_file
from pydicom import dcmread
from pydicom.datadict import dictionary_description
from pydicom.errors import InvalidDicomError
from pydicom.pixel_data_handlers.util import apply_voi_lut
from typing import cast, BinaryIO
from io import BytesIO
from PIL import Image
import numpy as np

app = Flask(__name__, static_folder='static', static_url_path='')


@app.route('/')
def index():
    return app.send_static_file('index.html')


@app.route('/upload', methods=['POST'])
def upload_dicom():
    file = request.files.get('file')
    if not file:
        return jsonify({"error": "No file provided"}), 400

    try:
        dicom_data = dcmread(cast(BinaryIO, file.stream), force=True)

        preamble_raw = getattr(dicom_data, 'preamble', None)
        if preamble_raw and preamble_raw != b'\x00' * 128:
            try:
                preamble = preamble_raw.decode('ascii', errors='ignore')
            except Exception:
                preamble = preamble_raw.hex()
        else:
            preamble = "No preamble available"
        preamble = preamble[:50] + "..." if len(preamble) > 50 else preamble

        dicom_prefix = str(dicom_data.file_meta.get('00020010', 'Not available'))
        dicom_prefix = dicom_prefix[:50] + "..." if len(dicom_prefix) > 50 else dicom_prefix

        dicom_dict = dicom_to_dict(dicom_data)

        # 📌 메모리에 보관해 이미지 보기 요청시 다시 사용
        request.environ['dicom_data'] = dicom_data

        return jsonify({
            "preamble": preamble,
            "dicom_prefix": dicom_prefix,
            "dicom_data": dicom_dict
        })

    except InvalidDicomError:
        return jsonify({"error": "Invalid DICOM file."}), 400
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "Server error while processing DICOM."}), 500


@app.route('/preview', methods=['POST'])
def preview_image():
    file = request.files.get('file')
    if not file:
        return jsonify({"error": "No file provided"}), 400

    try:
        dicom_data = dcmread(cast(BinaryIO, file.stream), force=True)

        pixel_array = dicom_data.pixel_array
        if hasattr(dicom_data, 'VOILUTFunction'):
            pixel_array = apply_voi_lut(pixel_array, dicom_data)

        pixel_array = pixel_array.astype(float)
        pixel_array -= np.min(pixel_array)
        pixel_array /= np.max(pixel_array)
        pixel_array *= 255.0

        image = Image.fromarray(pixel_array.astype(np.uint8)).convert('L')

        buffer = BytesIO()
        image.save(buffer, format='PNG')
        buffer.seek(0)

        return send_file(buffer, mimetype='image/png')

    except Exception as e:
        print("Preview error:", e)
        return jsonify({"error": "Failed to generate preview image."}), 500


def dicom_to_dict(dataset):
    result = {
        "name": "Information",
        "children": [
            {"name": "File Meta Information", "children": []},
            {"name": "Patient Information", "children": []},
            {"name": "Study Information", "children": []},
            {"name": "Series Information", "children": []},
            {"name": "Image Information", "children": []},
            {"name": "Pixel Data", "children": []}
        ]
    }

    group_dict = {
        "0002": result["children"][0],
        "0010": result["children"][1],
        "0020": result["children"][2],
        "0021": result["children"][3],
        "0028": result["children"][4],
        "7FE0": result["children"][5]
    }

    for elem in dataset:
        if not hasattr(elem, "tag"):
            continue

        group_number = f"{elem.tag.group:04X}"
        tag_id = str(elem.tag)
        vr = getattr(elem, 'VR', 'Unknown')
        vm = getattr(elem, 'VM', 'Unknown')
        value_length = len(str(elem.value)) if elem.value else 0

        try:
            value_field = str(elem.value)
        except Exception as e:
            value_field = f"[Error reading value: {e}]"

        if elem.tag.is_private:
            description = "Private"
        else:
            try:
                description = dictionary_description(elem.tag)
            except KeyError:
                description = "No description available"

        tag_info = {
            "tag_id": tag_id,
            "description": description,
            "vr": vr,
            "vm": vm,
            "value_length": value_length,
            "value_field": value_field
        }

        (group_dict[group_number]["children"] if group_number in group_dict else result["children"][4]["children"]).append(tag_info)

    return result


if __name__ == '__main__':
    app.run(debug=True)
