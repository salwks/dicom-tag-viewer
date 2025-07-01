# DICOM 분석기 - 의료영상 뷰어

전문적인 DICOM 의료영상 분석 및 측정 도구입니다.

## ✨ 주요 기능

- 📊 **구조 분석**: DICOM 파일의 계층적 구조 시각화
- 📋 **태그 정보**: 모든 DICOM 태그와 메타데이터 상세 확인
- 🖼️ **영상 뷰어**: 고품질 의료영상 뷰어와 정밀 측정 도구
- 🌙 **다크모드**: 현대적인 다크/라이트 테마 지원
- 📏 **측정 도구**: 거리, 각도, 면적 정밀 측정

## 🚀 빠른 시작

### 방법 1: 즉시 실행 (설치 불필요)

```bash
# Python 서버 실행
python app.py

# 브라우저에서 접속
http://localhost:5000
```

### 방법 2: 개발 환경 설정 (권장)

```bash
# 1. Node.js 패키지 설치
npm install

# 2. Python 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Python 의존성 설치
pip install -r requirements.txt

# 4. 개발 서버 실행
npm run dev
```

## 📦 설치 요구사항

### 필수 요구사항
- Python 3.8+
- Node.js 16+ (개발 환경용)

### Python 의존성
```
Flask==2.3.3
pydicom==2.4.3
Pillow==10.0.1
numpy==1.24.3
```

### Node.js 의존성 (개발용)
```
@chakra-ui/react==2.8.2
@emotion/react==11.11.1
@emotion/styled==11.11.0
framer-motion==10.16.4
d3==7.8.5
```

## 🛠️ 개발 환경

### 프로젝트 구조
```
dicom_viewer_revision/
├── app.py                 # Flask 서버
├── requirements.txt       # Python 의존성
├── package.json          # Node.js 의존성
├── static/
│   ├── index.html        # 메인 HTML
│   ├── css/
│   │   └── custom.css    # 커스텀 스타일
│   └── js/
│       ├── app.js        # 메인 애플리케이션
│       ├── core/         # 핵심 모듈
│       ├── modules/      # 기능 모듈
│       ├── controllers/  # 컨트롤러
│       └── services/     # 서비스
└── venv/                 # Python 가상환경
```

### 개발 명령어
```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 테스트 실행
npm test
```

## 🎨 UI 테마

### 다크모드/라이트모드
- 헤더의 🌙/☀️ 버튼으로 테마 전환
- 설정이 로컬 스토리지에 자동 저장
- 부드러운 전환 애니메이션

### Chakra UI 컴포넌트
- 일관된 디자인 시스템
- 접근성을 고려한 색상 대비
- 반응형 디자인

## 📱 지원 브라우저

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔧 문제 해결

### 일반적인 문제

1. **모듈을 찾을 수 없음**
   ```bash
   pip install -r requirements.txt
   ```

2. **포트 충돌**
   ```bash
   # 다른 포트로 실행
   python app.py --port 5001
   ```

3. **CORS 오류**
   - 브라우저 개발자 도구에서 확인
   - 서버가 올바른 포트에서 실행 중인지 확인

## 📄 라이선스

MIT License

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 지원

문제가 있거나 기능 요청이 있으시면 이슈를 생성해주세요. 