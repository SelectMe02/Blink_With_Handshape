// ========================================
// p5.js 코드 (확장본)
// ========================================

// 추가 기능:
//   - Shaka → BTN1
//   - OK    → BTN2
//   - Open  → BTN3
//   - OneUp/OneDown   : Red 시간 증가/감소
//   - TwoUp/TwoDown   : Yellow 시간 증가/감소
//   - FourUp/FourDown : Green 시간 증가/감소
//
// "Down" 제스처는 손등이 카메라 쪽을 향하고,
// 손가락이 아래로 내려간 상태를 인식하기 위해 tip.y > wrist.y + 60 정도로 설정

let port;

// LED 밝기와 상태 관련 변수
let brightness = 0;
let mode = "NORMAL";
let ledState = "None";

// LED의 동작 시간을 밀리초 단위로 지정 (초기값)
let redTime = 2000, yellowTime = 500, greenTime = 2000;

// ml5 라이브러리의 handpose 모델과 비디오 변수
let handPose;
let video;
// handpose를 통해 검출된 손 정보를 저장할 배열
let hands = [];

// 제스처 종류를 나타내는 변수 (검출된 제스처가 저장됨)
// 가능한 값: "Shaka", "OK", "Open",
//          "OneUp", "OneDown",
//          "TwoUp", "TwoDown",
//          "FourUp", "FourDown",
//          "None"
let currentGesture = "None";

// 제스처의 연속 동작(디바운스) 처리를 위한 변수들
let stableGesture = "None";       // 안정된(변화 없는) 제스처
let gestureStableStart = 0;         // 안정 시작 시간 (millis() 값)
let gestureActionDone = false;      // 해당 제스처에 대해 동작을 실행했는지 여부
let updateInterval = 1000;          // 반복 동작 시 업데이트 간격 (1초)
let lastTimeVF = 0;                 // 마지막 동작 실행 시간

// 슬라이더와 텍스트를 위한 DOM 요소 변수 (LED 동작 시간 조절용)
let redSlider, yellowSlider, greenSlider;
let redSpan, yellowSpan, greenSpan;

// 손가락 간의 연결(골격)을 그리기 위한 연결 정보
// 각 배열의 두 값은 keypoints 인덱스를 나타냄 (예: 손목, 엄지, 검지 등)
const fingerConnections = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20]
];


// =====================================================
// preload() 함수
// =====================================================
// p5.js의 preload() 함수는 setup() 전에 실행되어,
// 외부 라이브러리나 미디어 파일을 미리 로드할 때 사용
function preload() {
  // ml5의 handpose 모델을 초기화
  handPose = ml5.handPose();
}


// =====================================================
// setup() 함수
// =====================================================
// p5.js의 setup() 함수는 프로그램 실행 시 한 번 실행되며,
// 캔버스 생성, 비디오 설정, 시리얼 포트 초기화, DOM 요소 생성 등을 처리
function setup() {
  // 800x450 크기의 캔버스를 생성
  createCanvas(800, 450);

  // 비디오 캡쳐 생성 (flipped:true로 좌우 반전)
  video = createCapture(VIDEO, { flipped: true });
  video.size(320, 240);  // 비디오 크기를 320x240으로 설정
  video.hide();          // 비디오 엘리먼트를 숨김 (캔버스에 직접 그리기 위함)

  // handpose 모델을 이용하여 비디오에서 손 검출 시작
  // gotHands() 함수는 검출 결과가 업데이트될 때마다 호출됨
  handPose.detectStart(video, gotHands);

  // 시리얼 포트 초기화
  port = createSerial();
  // 이미 사용 중인 시리얼 포트 목록을 확인
  let usedPorts = usedSerialPorts();
  // 사용 가능한 포트가 있으면 첫 번째 포트를 열어 9600 보드레이트로 연결
  if (usedPorts.length > 0) {
    port.open(usedPorts[0], 9600);
  }

  // =====================================================
  // 시리얼 연결/해제 버튼 생성
  // =====================================================
  let connectBtn = createButton("Connect Serial");
  connectBtn.position(20, 20);               // 버튼 위치 지정
  connectBtn.mousePressed(connectBtnClick);  // 클릭 시 connectBtnClick() 함수 실행

  let disconnectBtn = createButton("Disconnect Serial");
  disconnectBtn.position(140, 20);
  disconnectBtn.mousePressed(() => {
    // 시리얼 포트가 열려있으면 닫고, 아니면 이미 닫혀있음을 콘솔에 출력
    if (port.opened()) {
      port.close();
      console.log("Serial Disconnected");
    } else {
      console.log("Serial is already closed");
    }
  });

  // =====================================================
  // LED 동작 시간 조절을 위한 슬라이더 및 텍스트 생성
  // =====================================================
  // 빨간색 LED 동작 시간 설정
  createP("Red Duration:");
  redSlider = createSlider(500, 5000, redTime);  // 최소 500ms, 최대 5000ms, 초기값 redTime
  redSlider.mouseReleased(changeSlider);         // 슬라이더 조작 후 마우스 릴리즈 시 changeSlider() 함수 실행
  redSpan = createSpan(` ${redTime} ms`);           // 현재 설정된 시간 표시

  // 노란색 LED 동작 시간 설정
  createP("Yellow Duration:");
  yellowSlider = createSlider(200, 2000, yellowTime);
  yellowSlider.mouseReleased(changeSlider);
  yellowSpan = createSpan(` ${yellowTime} ms`);

  // 초록색 LED 동작 시간 설정
  createP("Green Duration:");
  greenSlider = createSlider(500, 5000, greenTime);
  greenSlider.mouseReleased(changeSlider);
  greenSpan = createSpan(` ${greenTime} ms`);
}


// =====================================================
// draw() 함수
// =====================================================
// p5.js의 draw() 함수는 매 프레임마다 호출되며,
// 화면 업데이트, 비디오, 아두이노 데이터, 제스처 검출, LED 시각화 등을 처리
function draw() {
  // 배경을 회색(220)으로 채움
  background(220);

  // -----------------------------------------------------
  // (1) 비디오 화면 표시
  // 캔버스 내 350,20 좌표에서 360x280 크기로 비디오 이미지를 그림
  image(video, 350, 20, 360, 280);

  // -----------------------------------------------------
  // (2) 아두이노로부터 시리얼 데이터 읽어오기
  readSerialData();

  // -----------------------------------------------------
  // (3) 손 제스처를 분석하여 currentGesture 업데이트
  detectGesture();

  // -----------------------------------------------------
  // (4) 제스처에 따른 동작 실행
  //    - OneUp, OneDown, TwoUp, TwoDown, FourUp, FourDown은 1초 간격으로 반복 실행
  //    - Shaka, OK, Open은 디바운스(debounce)를 적용하여 한 번만 실행
  if (
    currentGesture === "OneUp" || currentGesture === "OneDown" ||
    currentGesture === "TwoUp" || currentGesture === "TwoDown" ||
    currentGesture === "FourUp" || currentGesture === "FourDown"
  ) {
    if (millis() - lastTimeVF >= updateInterval) {
      lastTimeVF = millis();
      handleGestureAction();
    }
  } else {
    // Shaka, OK, Open 제스처의 경우 안정 상태를 체크하여 한 번만 실행
    debounceGesture();
  }

  // -----------------------------------------------------
  // (5) 현재 상태(모드, LED 상태, 밝기, 제스처)를 화면에 텍스트로 표시
  fill(0);
  noStroke();
  textSize(16);
  text("Traffic Light Mode: " + mode, 20, 70);
  text("Current LED: " + ledState, 20, 110);
  text("Brightness: " + brightness, 20, 150);
  text("Gesture: " + currentGesture, 20, 190);

  // (5-1) 안정된 제스처 상태인 경우 안정된 시간(초) 표시
  if (stableGesture !== "None") {
    let elapsedSec = (millis() - gestureStableStart) / 1000;
    text("Gesture Stable: " + nf(elapsedSec, 1, 1) + " sec", 20, 230);
  }

  // -----------------------------------------------------
  // (6) LED 시각화: 각 모드에 따라 원(circle)으로 LED를 그려줌
  let alphaValue = map(brightness, 0, 255, 50, 255);  // 밝기에 따른 투명도 값 계산
  noStroke();
  if (mode === "Red Mode") {
    // 빨간색 모드: 빨간 LED는 밝게, 나머지는 어둡게 표시
    fill(255, 0, 0, alphaValue);
    circle(100, 270, 50);
    fill(0, 0, 0, 50);
    circle(100, 330, 50);
    circle(100, 390, 50);
  } else if (mode === "Blink Mode") {
    // 깜빡이는 모드: 프레임 수에 따라 LED on/off 전환
    let onOff = (frameCount % 30 < 15) ? alphaValue : 0;
    fill(255, 0, 0, onOff);
    circle(100, 270, 50);
    fill(255, 255, 0, onOff);
    circle(100, 330, 50);
    fill(0, 255, 0, onOff);
    circle(100, 390, 50);
  } else if (mode === "Power OFF") {
    // 전원 OFF 모드: 모든 LED를 어둡게(검정) 표시
    fill(0, 0, 0, 255);
    circle(100, 270, 50);
    circle(100, 330, 50);
    circle(100, 390, 50);
  } else {
    // 기본 모드: 현재 ledState에 따라 해당 LED를 밝게 표시
    let cRed    = color(255, 0, 0,   ledState === "Red"    ? alphaValue : 50);
    let cYellow = color(255, 255, 0, ledState === "Yellow" ? alphaValue : 50);
    let cGreen  = color(0, 255, 0,   ledState === "Green"  ? alphaValue : 50);
    fill(cRed);
    circle(100, 270, 50);
    fill(cYellow);
    circle(100, 330, 50);
    fill(cGreen);
    circle(100, 390, 50);
  }

  // -----------------------------------------------------
  // (7) 손의 골격(스켈레톤) 그리기
  push();  // 현재 좌표계를 저장
  // 비디오가 그려진 위치와 크기에 맞추어 좌표 변환
  translate(350, 20);
  scale(360 / video.width, 280 / video.height);
  drawHandSkeleton();  // 손 골격을 그리는 함수 호출
  pop();   // 좌표계를 복원

  // -----------------------------------------------------
  // (8) 슬라이더 옆에 현재 LED 동작 시간(ms) 업데이트하여 표시
  redSpan.html(` ${redTime} ms`);
  yellowSpan.html(` ${yellowTime} ms`);
  greenSpan.html(` ${greenTime} ms`);
}


// =====================================================
// drawHandSkeleton() 함수
// =====================================================
// 손의 각 keypoint(관절, 끝 점)들을 연결하여 손의 골격(스켈레톤)을 캔버스에 그림
function drawHandSkeleton() {
  // 감지된 손의 수만큼 반복
  for (let i = 0; i < hands.length; i++) {
    // 현재 손의 keypoints 배열 (각 keypoint에는 x, y 좌표가 있음)
    let kpts = hands[i].keypoints;
    
    // 손가락을 연결할 선의 스타일 설정 (녹색 선, 굵기 2)
    stroke(0, 255, 0);
    strokeWeight(2);
    noFill();
    // 미리 정의된 fingerConnections 배열을 순회하며 선을 그림
    for (let c of fingerConnections) {
      let start = kpts[c[0]];
      let end   = kpts[c[1]];
      // x 좌표는 좌우 반전을 위해 (video.width - x)로 계산
      let sx = video.width - start.x;
      let sy = start.y;
      let ex = video.width - end.x;
      let ey = end.y;
      line(sx, sy, ex, ey);
    }
    // 각 keypoint에 대해 작은 원을 그려 점으로 표시 (빨간색, 반지름 6)
    fill(255, 0, 0);
    noStroke();
    for (let j = 0; j < kpts.length; j++) {
      let x = kpts[j].x;
      let y = kpts[j].y;
      let flippedX = video.width - x;
      circle(flippedX, y, 6);
    }
  }
}


// =====================================================
// 시리얼 연결/해제 함수: connectBtnClick()
// =====================================================
// 버튼 클릭 시 시리얼 포트의 연결 상태를 토글 (열려있으면 닫고, 닫혀있으면 열기)
function connectBtnClick() {
  if (!port.opened()) {
    // 포트가 닫혀있으면 9600 보드레이트로 포트를 엶
    port.open(9600);
  } else {
    // 포트가 열려있으면 닫음
    port.close();
  }
}


// =====================================================
// changeSlider() 함수
// =====================================================
// 슬라이더 값이 변경되면 호출되어, 아두이노에 새 LED 동작 시간을 전송
function changeSlider() {
  // 시리얼 포트가 열려있는 경우에만 전송
  if (port.opened()) {
    // 각 슬라이더의 값을 읽어와 전역 변수 업데이트
    redTime = redSlider.value();
    yellowTime = yellowSlider.value();
    greenTime = greenSlider.value();
    // 전송할 데이터를 문자열 포맷으로 구성
    let data = `RED:${redTime}\nYELLOW:${yellowTime}\nGREEN:${greenTime}\n`;
    // 시리얼 포트로 데이터 전송
    port.write(data);
    console.log("Sent to Arduino:", data);
  } else {
    console.log("Serial Port is not open");
  }
}


// =====================================================
// readSerialData() 함수
// =====================================================
// 아두이노로부터 들어오는 데이터를 읽어와 파싱한 후,
// mode, ledState, brightness 등의 전역 변수 값을 업데이트
function readSerialData() {
  // 시리얼 버퍼에 데이터가 있는 경우
  if (port.available() > 0) {
    // 개행 문자("\n")까지 읽은 후, 문자열 앞뒤 공백 제거
    let data = port.readUntil("\n");
    data = data.trim();
    if (data.length > 0) {
      console.log("Received from Arduino:", data);
      // 데이터를 쉼표와 공백(", ")를 기준으로 분리
      let parts = data.split(", ");
      if (parts.length >= 3) {
        // 각 부분에서 콜론(:) 뒤의 값을 추출하여 변수 업데이트
        mode = parts[0].split(":")[1] || mode;
        let detectedLedState = parts[1].split(":")[1] || ledState;
        brightness = parseInt(parts[2].split(":")[1]) || brightness;
        // 모드에 따라 ledState를 별도로 설정
        if (mode === "Red Mode") {
          ledState = "Red";
        } else if (mode === "Blink Mode") {
          ledState = "ALL";
        } else if (mode === "Power OFF") {
          ledState = "None";
        } else {
          ledState = detectedLedState;
        }
      }
    }
  }
}


// =====================================================
// gotHands() 함수
// =====================================================
// handPose 모델의 결과 콜백 함수
// 전달받은 results(손 검출 결과)를 전역 변수 hands에 저장
function gotHands(results) {
  hands = results;
}


// =====================================================
// detectGesture() 함수
// =====================================================
// 손의 keypoints 정보를 이용하여 제스처를 판별하고,
// currentGesture 변수에 해당 제스처 이름을 저장
// - 기존 제스처: Shaka, OK, Open (버튼 동작으로 연결)
// - 새 제스처: OneUp/Down, TwoUp/Down, FourUp/Down (LED 시간 조절)
function detectGesture() {
  // 기본 제스처 상태는 "None"으로 초기화
  currentGesture = "None";
  // 손이 검출되었을 경우 (hands 배열에 값이 있을 경우)
  if (hands.length > 0) {
    let kpts = hands[0].keypoints;

    // -----------------------------------------------------
    // (A) 기존 제스처 판별: Shaka, OK, Open
    if (isShaka(kpts)) {
      currentGesture = "Shaka";
      return;
    }
    if (isOK(kpts)) {
      currentGesture = "OK";
      return;
    }
    if (isOpenHand(kpts)) {
      currentGesture = "Open";
      return;
    }

    // -----------------------------------------------------
    // (B) 새로 추가된 제스처 판별
    if (isOneUp(kpts))    { currentGesture = "OneUp";    return; }
    if (isOneDown(kpts))  { currentGesture = "OneDown";  return; }
    if (isFourUp(kpts))   { currentGesture = "FourUp";   return; }
    if (isFourDown(kpts)) { currentGesture = "FourDown"; return; }
    if (isTwoUp(kpts))    { currentGesture = "TwoUp";    return; }
    if (isTwoDown(kpts))  { currentGesture = "TwoDown";  return; }
  }
}


// =====================================================
// whichFingersExtended() 함수
// =====================================================
// 손의 각 손가락이 펴져있는지 여부를 판단하여 배열로 반환
// 기준: 손목보다 tip의 y 좌표가 margin 만큼 작으면 '펴짐'으로 간주
function whichFingersExtended(kpts) {
  let margin = 55;              // 기준 마진 값
  let wristY = kpts[0].y;         // 손목의 y 좌표
  // thumb, index, middle, ring, pinky가 펴졌는지 여부를 저장하는 배열 (초기값 모두 false)
  let result = [false, false, false, false, false];

  // 각 손가락의 tip의 y 좌표가 (손목의 y - margin) 보다 작으면 true로 설정
  // kpts 인덱스: thumb=4, index=8, middle=12, ring=16, pinky=20
  if (kpts[4].y  < wristY - margin) result[0] = true;
  if (kpts[8].y  < wristY - margin) result[1] = true;
  if (kpts[12].y < wristY - margin) result[2] = true;
  if (kpts[16].y < wristY - margin) result[3] = true;
  if (kpts[20].y < wristY - margin) result[4] = true;

  return result;
}


// =====================================================
// 기존 제스처 판별 함수들
// =====================================================

// isShaka() 함수: Shaka 제스처인지 판단
// 조건: 두 손가락만 펴져 있고, 엄지(인덱스 0)와 새끼손가락(인덱스 4)이 펴진 상태
function isShaka(kpts) {
  let arr = whichFingersExtended(kpts);
  let count = arr.filter(x => x).length;  // 펴진 손가락의 개수
  return (count === 2 && arr[0] && arr[4]);
}

// isOK() 함수: OK 제스처인지 판단
// 조건: 엄지와 검지 사이의 거리가 30 미만이며, 나머지 손가락(중지, 약지, 새끼)이 펴진 상태
function isOK(kpts) {
  let thumbTip = kpts[4];
  let indexTip = kpts[8];
  let dx = thumbTip.x - indexTip.x;
  let dy = thumbTip.y - indexTip.y;
  let dist = sqrt(dx * dx + dy * dy);

  let arr = whichFingersExtended(kpts);
  return (dist < 30 && arr[2] && arr[3] && arr[4]);
}

// isOpenHand() 함수: 손 전체가 펴진 상태인지 판단
// 조건: 모든 손가락(5개)이 펴진 경우
function isOpenHand(kpts) {
  let arr = whichFingersExtended(kpts);
  let count = arr.filter(x => x).length;
  return (count === 5);
}


// =====================================================
// 새로 추가된 제스처 판별 함수들 (LED 시간 제어용)
// =====================================================

// isOneUp() 함수: OneUp 제스처 판별
// 조건: 오직 검지만 펴졌으며, 검지의 tip이 손목보다 30만큼 위에 있는 경우
function isOneUp(kpts){
  let arr = whichFingersExtended(kpts);
  // 오직 검지(index)만 펴진 상태
  if (arr[1] && !arr[0] && !arr[2] && !arr[3] && !arr[4]) {
    let indexTip = kpts[8];
    let wrist = kpts[0];
    // 검지의 tip이 손목보다 30만큼 위에 있는지 판단 (y 값이 작을수록 위쪽)
    return (indexTip.y < wrist.y - 30);
  }
  return false;
}

// isOneDown() 함수: OneDown 제스처 판별
// 조건: 오직 검지만 펴졌고, 검지의 tip이 손목보다 60만큼 아래에 있으면서
//       중지와 새끼손가락이 검지보다 위에 있을 때 (손등 아래 방향)
function isOneDown(kpts){
  let arr = whichFingersExtended(kpts);
  let indexTip = kpts[8];
  let middleTip = kpts[12];
  let pinkyTip  = kpts[20];
  let wrist = kpts[0];
  // 검지의 tip이 손목보다 60만큼 아래에 있고, 중지와 새끼손가락은 검지보다 위에 있는지 체크
  if (indexTip.y > wrist.y + 60 && middleTip.y < indexTip.y && pinkyTip.y < indexTip.y) {
    return true;
  }
  return false;
}

// isTwoUp() 함수: TwoUp 제스처 판별
// 조건: 검지와 중지만 펴졌으며, 두 손가락 모두 손목보다 30만큼 위에 있는 경우
function isTwoUp(kpts){
  let arr = whichFingersExtended(kpts);
  if (arr[1] && arr[2] && !arr[0] && !arr[3] && !arr[4]) {
    let indexTip = kpts[8];
    let middleTip = kpts[12];
    let wrist = kpts[0];
    return (indexTip.y < wrist.y - 30 && middleTip.y < wrist.y - 30);
  }
  return false;
}

// isTwoDown() 함수: TwoDown 제스처 판별
// 조건: 검지와 중지가 펴졌으며, 두 손가락 모두 손목보다 60만큼 아래에 있고,
//       새끼손가락이 중지보다 위에 있을 때
function isTwoDown(kpts){
  let arr = whichFingersExtended(kpts);
  let indexTip = kpts[8];
  let middleTip = kpts[12];
  let pinkyTip  = kpts[20];
  let wrist = kpts[0];
  if (indexTip.y > wrist.y + 60 && middleTip.y > wrist.y + 60 && pinkyTip.y < middleTip.y) {
    return true;
  }
  return false;
}

// isFourUp() 함수: FourUp 제스처 판별
// 조건: 검지, 중지, 새끼손가락이 펴졌으며, 약지는 약간 허용(전체 펴진 개수가 3~4개)
//       그리고 세 손가락 모두 손목보다 localMargin(20) 만큼 위에 있는 경우
function isFourUp(kpts){
  let arr = whichFingersExtended(kpts);
  if (arr[1] && arr[2] && arr[4] && !arr[0]) {
    let count = arr.filter(x => x).length;
    if (count >= 3 && count <= 4) {
      let indexTip  = kpts[8];
      let middleTip = kpts[12];
      let pinkyTip  = kpts[20];
      let wrist = kpts[0];
      let localMargin = 20;
      return (
        indexTip.y  < wrist.y - localMargin &&
        middleTip.y < wrist.y - localMargin &&
        pinkyTip.y  < wrist.y - localMargin
      );
    }
  }
  return false;
}

// isFourDown() 함수: FourDown 제스처 판별
// 조건: 검지, 중지, 새끼손가락이 펴졌으며, 이들의 tip이 손목보다 60만큼 아래에 있을 때
function isFourDown(kpts){
  let arr = whichFingersExtended(kpts);
  let indexTip  = kpts[8];
  let middleTip = kpts[12];
  let pinkyTip  = kpts[20];
  let wrist = kpts[0];
  if (indexTip.y > wrist.y + 60 &&
      middleTip.y > wrist.y + 60 &&
      pinkyTip.y > wrist.y + 60) {
    return true;
  }
  return false;
}


// =====================================================
// handleGestureAction() 함수
// =====================================================
// 현재 감지된 제스처(currentGesture)에 따라 시리얼 포트를 통해
// 아두이노에 명령을 전송하여 동작을 실행하거나 LED 시간을 증감시킴
function handleGestureAction(){
  // 시리얼 포트가 열려있지 않으면 함수 실행 중단
  if(!port.opened()) return;

  // 현재 제스처에 따른 동작 선택
  switch(currentGesture){
    // 기존 기능: Shaka, OK, Open (각각 다른 버튼 명령 전송)
    case "Shaka":
      port.write("BTN1\n");
      console.log("Shaka → BTN1");
      break;
    case "OK":
      port.write("BTN2\n");
      console.log("OK → BTN2");
      break;
    case "Open":
      port.write("BTN3\n");
      console.log("Open → BTN3");
      break;

    // 새로 추가된 제스처: LED 동작 시간을 증감시키는 명령
    case "OneUp":
      redTime += 300;
      if(redTime > 5000) redTime = 5000;  // 최대 5000ms 제한
      port.write(`RED:${redTime}\n`);
      console.log("OneUp → Red++ =>", redTime);
      break;
    case "OneDown":
      redTime -= 300;
      if(redTime < 500) redTime = 500;    // 최소 500ms 제한
      port.write(`RED:${redTime}\n`);
      console.log("OneDown → Red-- =>", redTime);
      break;
    case "TwoUp":
      yellowTime += 150;
      if(yellowTime > 2000) yellowTime = 2000;
      port.write(`YELLOW:${yellowTime}\n`);
      console.log("TwoUp → Yellow++ =>", yellowTime);
      break;
    case "TwoDown":
      yellowTime -= 150;
      if(yellowTime < 200) yellowTime = 200;
      port.write(`YELLOW:${yellowTime}\n`);
      console.log("TwoDown → Yellow-- =>", yellowTime);
      break;
    case "FourUp":
      greenTime += 300;
      if(greenTime > 5000) greenTime = 5000;
      port.write(`GREEN:${greenTime}\n`);
      console.log("FourUp → Green++ =>", greenTime);
      break;
    case "FourDown":
      greenTime -= 300;
      if(greenTime < 500) greenTime = 500;
      port.write(`GREEN:${greenTime}\n`);
      console.log("FourDown → Green-- =>", greenTime);
      break;
    default:
      break;
  }

  // 슬라이더와 표시용 DOM 요소들을 현재 값으로 동기화
  redSlider.value(redTime);
  yellowSlider.value(yellowTime);
  greenSlider.value(greenTime);
}


// =====================================================
// debounceGesture() 함수 (디바운스 처리)
// =====================================================
// 제스처가 갑자기 바뀌는 것을 막기 위해 안정된 제스처 상태일 때만 동작을 실행
// - OneUp/Down, TwoUp/Down, FourUp/Down은 1초마다 반복 실행
// - Shaka, OK, Open은 1초 이상 제스처가 안정되어야 한 번만 실행
function debounceGesture(){
  // 만약 현재 제스처가 LED 시간 제어용 제스처라면 디바운스 처리 없이 바로 return
  if(
    currentGesture === "OneUp" || currentGesture === "OneDown" ||
    currentGesture === "TwoUp" || currentGesture === "TwoDown" ||
    currentGesture === "FourUp" || currentGesture === "FourDown"
  ){
    return;
  }

  // 만약 제스처가 변경되었다면, 안정 시간과 실행 여부를 초기화
  if(currentGesture !== stableGesture){
    stableGesture = currentGesture;
    gestureStableStart = millis();
    gestureActionDone = false;
  } else {
    // 현재 제스처가 "None"이 아니고, 아직 동작을 실행하지 않았으며,
    // 1초 이상 안정 상태라면 제스처 동작 함수를 실행하고 실행 완료 표시
    if(currentGesture !== "None" && !gestureActionDone && (millis() - gestureStableStart >= 1000)){
      handleGestureAction();
      gestureActionDone = true;
    }
  }
}
