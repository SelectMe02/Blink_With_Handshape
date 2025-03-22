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
let brightness = 0;
let mode = "NORMAL";
let ledState = "None";

// LED 동작 시간 (ms)
let redTime = 2000, yellowTime = 500, greenTime = 2000;

// ml5 handpose
let handPose;
let video;
let hands = [];

// 제스처 종류:
//   "Shaka", "OK", "Open",
//   "OneUp", "OneDown",
//   "TwoUp", "TwoDown",
//   "FourUp", "FourDown",
//   "None"
let currentGesture = "None";

// Debounce/연속동작
let stableGesture = "None";
let gestureStableStart = 0;
let gestureActionDone = false;
let updateInterval = 1000; 
let lastTimeVF = 0;

// 슬라이더 & 표시용 DOM
let redSlider, yellowSlider, greenSlider;
let redSpan, yellowSpan, greenSpan;

// 손가락 골격 연결
const fingerConnections = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20]
];

function preload() {
  handPose = ml5.handPose();
}

function setup() {
  createCanvas(800, 450);

  // 비디오 (flipped:true)
  video = createCapture(VIDEO, { flipped: true });
  video.size(320, 240);
  video.hide();

  // handpose 시작
  handPose.detectStart(video, gotHands);

  // 시리얼포트 초기화
  port = createSerial();
  let usedPorts = usedSerialPorts();
  if (usedPorts.length > 0) {
    port.open(usedPorts[0], 9600);
  }

  // 연결/해제 버튼
  let connectBtn = createButton("Connect Serial");
  connectBtn.position(20, 20);
  connectBtn.mousePressed(connectBtnClick);

  let disconnectBtn = createButton("Disconnect Serial");
  disconnectBtn.position(140, 20);
  disconnectBtn.mousePressed(() => {
    if (port.opened()) {
      port.close();
      console.log("Serial Disconnected");
    } else {
      console.log("Serial is already closed");
    }
  });

  // 슬라이더 & 텍스트
  createP("Red Duration:");
  redSlider = createSlider(500, 5000, redTime);
  redSlider.mouseReleased(changeSlider);
  redSpan = createSpan(` ${redTime} ms`);

  createP("Yellow Duration:");
  yellowSlider = createSlider(200, 2000, yellowTime);
  yellowSlider.mouseReleased(changeSlider);
  yellowSpan = createSpan(` ${yellowTime} ms`);

  createP("Green Duration:");
  greenSlider = createSlider(500, 5000, greenTime);
  greenSlider.mouseReleased(changeSlider);
  greenSpan = createSpan(` ${greenTime} ms`);
}

function draw() {
  background(220);

  // (1) 비디오 표시
  image(video, 350, 20, 360, 280);

  // (2) 아두이노 데이터
  readSerialData();

  // (3) 제스처 판별
  detectGesture();

  // (4) OneUp/Down, TwoUp/Down, FourUp/Down → 1초마다 반복
  //     Shaka/OK/Open → Debounce
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
    debounceGesture();
  }

  // (5) 상태 표시
  fill(0);
  noStroke();
  textSize(16);
  text("Traffic Light Mode: " + mode, 20, 70);
  text("Current LED: " + ledState, 20, 110);
  text("Brightness: " + brightness, 20, 150);
  text("Gesture: " + currentGesture, 20, 190);

  // (5-1) 안정 시간 출력
  if (stableGesture !== "None") {
    let elapsedSec = (millis() - gestureStableStart) / 1000;
    text("Gesture Stable: " + nf(elapsedSec, 1, 1) + " sec", 20, 230);
  }

  // (6) LED 시각화
  let alphaValue = map(brightness, 0, 255, 50, 255);
  noStroke();
  if (mode === "Red Mode") {
    fill(255, 0, 0, alphaValue);
    circle(100, 270, 50);
    fill(0, 0, 0, 50);
    circle(100, 330, 50);
    circle(100, 390, 50);
  } else if (mode === "Blink Mode") {
    let onOff = (frameCount % 30 < 15) ? alphaValue : 0;
    fill(255, 0, 0, onOff);
    circle(100, 270, 50);
    fill(255, 255, 0, onOff);
    circle(100, 330, 50);
    fill(0, 255, 0, onOff);
    circle(100, 390, 50);
  } else if (mode === "Power OFF") {
    fill(0, 0, 0, 255);
    circle(100, 270, 50);
    circle(100, 330, 50);
    circle(100, 390, 50);
  } else {
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

  // (7) 손 골격
  push();
  translate(350, 20);
  scale(360 / video.width, 280 / video.height);
  drawHandSkeleton();
  pop();

  // (8) 슬라이더 옆 ms 표시
  redSpan.html(` ${redTime} ms`);
  yellowSpan.html(` ${yellowTime} ms`);
  greenSpan.html(` ${greenTime} ms`);
}

// ----------------------------------------------------
// 골격 그리기
// ----------------------------------------------------
function drawHandSkeleton() {
  for (let i = 0; i < hands.length; i++) {
    let kpts = hands[i].keypoints;
    stroke(0, 255, 0);
    strokeWeight(2);
    noFill();
    for (let c of fingerConnections) {
      let start = kpts[c[0]];
      let end   = kpts[c[1]];
      let sx = video.width - start.x;
      let sy = start.y;
      let ex = video.width - end.x;
      let ey = end.y;
      line(sx, sy, ex, ey);
    }
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

// ----------------------------------------------------
// 시리얼 연결/해제
// ----------------------------------------------------
function connectBtnClick() {
  if (!port.opened()) {
    port.open(9600);
  } else {
    port.close();
  }
}

// ----------------------------------------------------
// 슬라이더 변경 -> 아두이노 전송
// ----------------------------------------------------
function changeSlider() {
  if (port.opened()) {
    redTime = redSlider.value();
    yellowTime = yellowSlider.value();
    greenTime = greenSlider.value();
    let data = `RED:${redTime}\nYELLOW:${yellowTime}\nGREEN:${greenTime}\n`;
    port.write(data);
    console.log("Sent to Arduino:", data);
  } else {
    console.log("Serial Port is not open");
  }
}

// ----------------------------------------------------
// 아두이노에서 들어오는 데이터 처리
// ----------------------------------------------------
function readSerialData() {
  if (port.available() > 0) {
    let data = port.readUntil("\n");
    data = data.trim();
    if (data.length > 0) {
      console.log("Received from Arduino:", data);
      let parts = data.split(", ");
      if (parts.length >= 3) {
        mode = parts[0].split(":")[1] || mode;
        let detectedLedState = parts[1].split(":")[1] || ledState;
        brightness = parseInt(parts[2].split(":")[1]) || brightness;
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

// ----------------------------------------------------
// handPose 결과 콜백
// ----------------------------------------------------
function gotHands(results) {
  hands = results;
}

// ----------------------------------------------------
// 제스처 판별
//   - Shaka, OK, Open → BTN 기능
//   - OneUp/Down, TwoUp/Down, FourUp/Down → LED 시간 제어
// ----------------------------------------------------
function detectGesture() {
  currentGesture = "None";
  if (hands.length > 0) {
    let kpts = hands[0].keypoints;

    // (A) 기존 기능: Shaka, OK, Open
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

    // (B) 추가된 제스처
    if (isOneUp(kpts))    { currentGesture = "OneUp";    return; }
    if (isOneDown(kpts))  { currentGesture = "OneDown";  return; }
    if (isFourUp(kpts))   { currentGesture = "FourUp";   return; }
    if (isFourDown(kpts)) { currentGesture = "FourDown"; return; }
    if (isTwoUp(kpts))    { currentGesture = "TwoUp";    return; }
    if (isTwoDown(kpts))  { currentGesture = "TwoDown";  return; }
  }
}

// ----------------------------------------------------
// whichFingersExtended()
//   tip.y < wrist.y - margin => '펴짐' (Up)
//   (Down은 별도 y 조건에서 판단)
// ----------------------------------------------------
function whichFingersExtended(kpts) {
  let margin = 55;
  let wristY = kpts[0].y;
  let result = [false,false,false,false,false];

  // thumb=4, index=8, middle=12, ring=16, pinky=20
  if (kpts[4].y  < wristY - margin) result[0] = true;
  if (kpts[8].y  < wristY - margin) result[1] = true;
  if (kpts[12].y < wristY - margin) result[2] = true;
  if (kpts[16].y < wristY - margin) result[3] = true;
  if (kpts[20].y < wristY - margin) result[4] = true;

  return result;
}

// ----------------------------------------------------
// 기존 제스처: Shaka, OK, Open
// ----------------------------------------------------
function isShaka(kpts) {
  let arr = whichFingersExtended(kpts);
  let count = arr.filter(x=>x).length;
  return (count===2 && arr[0] && arr[4]);
}

function isOK(kpts) {
  let thumbTip = kpts[4];
  let indexTip = kpts[8];
  let dx = thumbTip.x - indexTip.x;
  let dy = thumbTip.y - indexTip.y;
  let dist = sqrt(dx*dx + dy*dy);

  let arr = whichFingersExtended(kpts);
  return (dist<30 && arr[2] && arr[3] && arr[4]);
}

function isOpenHand(kpts) {
  let arr = whichFingersExtended(kpts);
  let count = arr.filter(x=>x).length;
  return (count===5);
}

// ----------------------------------------------------
// 새로 추가된 6 제스처 (OneUp/Down, TwoUp/Down, FourUp/Down)
// ----------------------------------------------------
function isOneUp(kpts){
  let arr = whichFingersExtended(kpts);
  // index만 펴짐
  if (arr[1] && !arr[0] && !arr[2] && !arr[3] && !arr[4]) {
    let indexTip = kpts[8];
    let wrist = kpts[0];
    // Up => tip.y < wrist.y - 30
    return (indexTip.y < wrist.y - 30);
  }
  return false;
}

function isOneDown(kpts){
  let arr = whichFingersExtended(kpts);
  // index만 펴짐, 손등 아래로
  let indexTip = kpts[8];
  let middleTip = kpts[12];
  let pinkyTip  = kpts[20];
  let wrist = kpts[0];
  // Down => tip.y > wrist.y + 60
  if (indexTip.y > wrist.y + 60 && middleTip.y < indexTip.y && pinkyTip.y < indexTip.y) {
    return true;
  //if (arr[1] && !arr[0] && !arr[2] && !arr[3] && !arr[4]) {
    }
  return false;
  }


function isTwoUp(kpts){
  let arr = whichFingersExtended(kpts);
  // index+middle
  if (arr[1] && arr[2] && !arr[0] && !arr[3] && !arr[4]) {
    let indexTip = kpts[8];
    let middleTip= kpts[12];
    let wrist = kpts[0];
    return (indexTip.y < wrist.y - 30 && middleTip.y < wrist.y - 30);
  }
  return false;
}

function isTwoDown(kpts){
  let arr = whichFingersExtended(kpts);
  // index+middle
  let indexTip = kpts[8];
  let middleTip= kpts[12];
  let pinkyTip  = kpts[20];
  let wrist = kpts[0];
  // Down => tip.y > wrist.y + 60
  if (indexTip.y > wrist.y + 60 && middleTip.y > wrist.y + 60 && pinkyTip.y < middleTip.y) {
    return true;
  }
  return false;
}

function isFourUp(kpts){
  let arr = whichFingersExtended(kpts);
  // index=1, middle=2, pinky=4 => true
  // 약지=3는 약간 허용 => count=3~4
  if (arr[1] && arr[2] && arr[4] && !arr[0]) {
    let count = arr.filter(x=>x).length;
    if (count>=3 && count<=4) {
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

function isFourDown(kpts){
  let arr = whichFingersExtended(kpts);
  // index=1, middle=2, pinky=4 => true, thumb=0/ring=3 => false
  let indexTip  = kpts[8];
  let middleTip = kpts[12];
  let pinkyTip  = kpts[20];
  let wrist = kpts[0];
  // Down => tip.y > wrist.y + 60
  if (indexTip.y  > wrist.y + 60 &&
      middleTip.y > wrist.y + 60 &&
      pinkyTip.y  > wrist.y + 60) {
    return true;
  }
  return false;
}


// ----------------------------------------------------
// 제스처별 동작 실행
// ----------------------------------------------------
function handleGestureAction(){
  if(!port.opened()) return;

  switch(currentGesture){
    // 기존 기능
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

    // 새로 추가된 6 제스처 => 각각 LED 동작 시간 증감
    case "OneUp":
      redTime += 300;
      if(redTime>5000) redTime=5000;
      port.write(`RED:${redTime}\n`);
      console.log("OneUp → Red++ =>", redTime);
      break;
    case "OneDown":
      redTime -= 300;
      if(redTime<500) redTime=500;
      port.write(`RED:${redTime}\n`);
      console.log("OneDown → Red-- =>", redTime);
      break;
    case "TwoUp":
      yellowTime += 150;
      if(yellowTime>2000) yellowTime=2000;
      port.write(`YELLOW:${yellowTime}\n`);
      console.log("TwoUp → Yellow++ =>", yellowTime);
      break;
    case "TwoDown":
      yellowTime -= 150;
      if(yellowTime<200) yellowTime=200;
      port.write(`YELLOW:${yellowTime}\n`);
      console.log("TwoDown → Yellow-- =>", yellowTime);
      break;
    case "FourUp":
      greenTime += 300;
      if(greenTime>5000) greenTime=5000;
      port.write(`GREEN:${greenTime}\n`);
      console.log("FourUp → Green++ =>", greenTime);
      break;
    case "FourDown":
      greenTime -= 300;
      if(greenTime<500) greenTime=500;
      port.write(`GREEN:${greenTime}\n`);
      console.log("FourDown → Green-- =>", greenTime);
      break;
    default:
      break;
  }

  // 슬라이더 동기화
  redSlider.value(redTime);
  yellowSlider.value(yellowTime);
  greenSlider.value(greenTime);
}

// ----------------------------------------------------
// Debounce 로직
//  - Shaka, OK, Open => 1초 이상 안정 시 한 번만
//  - OneUp/Down, TwoUp/Down, FourUp/Down => 1초마다 반복
// ----------------------------------------------------
function debounceGesture(){
  if(
    currentGesture==="OneUp"||currentGesture==="OneDown"||
    currentGesture==="TwoUp"||currentGesture==="TwoDown"||
    currentGesture==="FourUp"||currentGesture==="FourDown"
  ){
    return;
  }

  // 기존 Debounce: Shaka/OK/Open
  if(currentGesture!==stableGesture){
    stableGesture=currentGesture;
    gestureStableStart=millis();
    gestureActionDone=false;
  } else {
    if(currentGesture!=="None" && !gestureActionDone && (millis()-gestureStableStart>=1000)){
      handleGestureAction();
      gestureActionDone=true;
    }
  }
}
