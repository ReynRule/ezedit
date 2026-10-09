# 미디어 툴박스

백엔드 없이 브라우저에서만 동작하는 이미지/동영상 도구 (GitHub Pages 배포용).

- **이미지**: 용량 줄이기(화질·목표 KB), 크기 축소/확대(배율·가로·세로·직접 지정), JPG/WebP/PNG 변환, 여러 장 일괄
- **동영상 용량 줄이기**: 해상도, 화질(CRF), 속도, FPS, 소리 제거/비트레이트
- **동영상 편집**: 구간 자르기 / 중간 구간 삭제 후 이어붙이기, 음악 넣기(섞기·교체, 시작 시점, 볼륨, 페이드 인/아웃, 반복), 영상 페이드, 해상도·화질 지정

## 배포 방법
1. 이 폴더 전체를 GitHub 저장소(`main` 브랜치)에 푸시
2. 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions** 선택
3. Actions 탭에서 `Deploy to GitHub Pages` 가 끝나면 `https://<아이디>.github.io/<저장소>/` 로 접속

워크플로우가 `npm install` 로 ffmpeg.wasm 을 받아 `dist/vendor/` 로 복사한 뒤 배포합니다.
(Worker 는 다른 도메인 CDN 에서 못 불러오기 때문에 같은 도메인에 두어야 합니다.)

## 로컬 실행
```bash
npm install
npm run dev     # http://localhost:5173
```
`file://` 로 직접 열면 동작하지 않으니 꼭 서버로 여세요.

## 알아둘 점
- GitHub Pages 는 COOP/COEP 헤더를 못 붙여서 **단일 스레드** ffmpeg 코어를 씁니다. 동영상은 PC 성능에 따라 느립니다.
- 파일이 1.5GB 를 넘으면 브라우저 메모리 한계로 실패할 수 있습니다.
- 동영상 결과는 항상 MP4(H.264 + AAC) 입니다.
- 이미지 `PNG` 는 화질 슬라이더가 없어 크기(px)로만 줄어듭니다.
