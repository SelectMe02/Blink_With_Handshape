## **(확장)  임베디드 통신 시스템 Assignment 2 - Blink Control by Handshape**

### 프로젝트 동작 목적

기존의 버튼, 슬라이더, 가변저항 위주의 신호등 제어 방식을 비전 기반 제스처 인식으로 확장하는 것을 목표로 합니다.
웹캠 영상을 HandPose로 분석해 특정 손동작을 감지하면, 시리얼 통신을 통해 아두이노로 명령을 전송합니다.

아두이노 측에서는 TaskSerialInput과 TaskSerialOutput 테스크를 통해 아래와 같은 다양한 기능을 실시간으로 제어할 수 있습니다

#### ✋ 손동작 설명

| 손동작 | 이미지 |
|--------|--------|
| Shaka   | ![](Images/Saka_Sign.png) |
| OK     | ![](Images/OK_Sign.png) |
| Open   | ![](Images/Handopen_Sign.png) |
| OneUp  | ![](Images/OneUp.png) |
| OneDown | ![](Images/OneDown.png) |
| TwoUp  | ![](Images/TwoUp.png) |
| TwoDown | ![](Images/TwoDown.png) |
| FourUp | ![](Images/FourUp.png) |
| FourDown | ![](Images/FourDown.png) |


#### 기능 설명:

- **Shaka**: 새끼손가락과 엄지만 펴져 있는 상태 → **비상 모드 진입 및 해제**
- **OK**: 오케이 사인 → **Blink Mode 진입 및 해제**
- **Open**: 다섯 손가락을 모두 펼친 상태 → **Power Off / On 기능**
- **OneUp**: 검지만 펴져 있음 → `Red led Duration` **증가**
- **OneDown**: 검지만 내림 → `Red led Duration` **감소**
- **TwoUp**: 검지와 중지만 펴짐 → `Yellow led Duration` **증가**
- **TwoDown**: 검지와 중지만 내림 → `Yellow led Duration` **감소**
- **FourUp**: 엄지 빼고 모두 핀 상태 → `Green led Duration` **증가**
- **FourDown**: 엄지 빼고 모두 내린 상태 → `Green led Duration` **감소**


**이때 OneDown, TwoDown, FourDown과 같이 손가락을 내리는 제스쳐는 손등을 카메라를 보도록 향해야 함.**

---

## 기존 코드 vs 확장된 코드 비교: 추가된 기능 요약 - Arduino

### 1. 시리얼 명령으로 모드 전환 가능 (BTN1/BTN2/BTN3 명령 추가)

#### 추가된 부분 (`serialReceive` 함수 내부):

```cpp
// BTN1 / BTN2 / BTN3 명령 처리
if (command.startsWith("BTN1")) {
    switch1_ISR();  // 버튼1 ISR 직접 호출
}
if (command.startsWith("BTN2")) {
    switch2_ISR();  // 버튼2 ISR 직접 호출
}
if (command.startsWith("BTN3")) {
    switch3_ISR();  // 버튼3 ISR 직접 호출
}
```


## 정리: 수정된 코드의 주요 확장 기능

| 기능                                                    | 기존 코드 | 수정된 코드 |
|---------------------------------------------------------|:---------:|:-----------:|
| LED 지속시간 시리얼 설정                                 | ✅        | ✅          |
| 버튼 ISR 하드웨어 누름 감지                              | ✅        | ✅          |
| 버튼 ISR을 시리얼 명령(BTN1~3)으로 직접 호출             | ❌        | ✅          |
| Web UI/제스처 인식과의 확장 연동 가능                    | ❌        | ✅          |

---

## 기존 코드 vs 확장된 코드 비교: 추가된 기능 요약 - p5.js

## ✅ p5.js 코드 기능 비교: 기존 코드 vs 확장 코드

### 📌 기능 요약 비교

| 기능 항목                                      | 기존 코드 | 확장 코드 |
|-----------------------------------------------|:---------:|:---------:|
| 시리얼 연결/해제 및 슬라이더 값 전송           | ✅        | ✅        |
| 아두이노로부터 LED 상태, 밝기, 모드 수신       | ✅        | ✅        |
| 슬라이더로 LED 시간 조절 (Red/Yellow/Green)    | ✅        | ✅        |
| LED 밝기에 따른 시각적 반영 (alpha) 처리       | ✅        | ✅        |
| 버튼 3개 동작 대응 (BTN1~3)                   | ✅        | ✅        |
| **HandPose 기반 손 제스처 인식 기능 추가**     | ❌        | ✅        |
| 제스처 기반 모드 전환 (`Shaka`, `OK`, `Open`) | ❌        | ✅        |
| 제스처 기반 시간 제어 (`OneUp/Down`, `...`)    | ❌        | ✅        |
| 손가락 골격 시각화 및 실시간 표시              | ❌        | ✅        |
| 제스처 안정성 체크 및 디바운스 처리           | ❌        | ✅        |

---

### ✋ 추가된 제스처 기능 요약

| 제스처 이름      | 의미/기능                                 |
|------------------|--------------------------------------------|
| `Shaka`          | BTN1 역할 (Red Mode 진입/해제)             |
| `OK`             | BTN2 역할 (Blink Mode 진입/해제)           |
| `Open`           | BTN3 역할 (전원 끔/켜기 모드)              |
| `OneUp`          | Red 시간 증가                              |
| `OneDown`        | Red 시간 감소                              |
| `TwoUp`          | Yellow 시간 증가                           |
| `TwoDown`        | Yellow 시간 감소                           |
| `FourUp`         | Green 시간 증가                            |
| `FourDown`       | Green 시간 감소                            |

---

### 🧠 제스처 동작 흐름 요약

- **기본 모드 전환 제스처**  
  - Shaka → BTN1, OK → BTN2, Open → BTN3  
  - 1초 이상 안정되었을 경우에만 단일 전송

- **시간 제어 제스처**  
  - One/Two/Four Up/Down  
  - `millis()` 기준 1초마다 반복 수행 (지속적 조절 가능)

- **손가락 골격 실시간 시각화**  
  - `ml5.js`의 `handPose` 모델 사용  
  - 손가락 위치를 선과 원으로 그려 추적 시각화

---

## **(기존) 임베디드 통신 시스템 Assignment 1 - Blink Control with Arduino**

---



### [Youtube Link]

https://www.youtube.com/watch?v=JQ22_3igJNU


![](images/Blinker_Mapping_Using_Arduino.png)


본 프로젝트는 3색 LED(빨강, 노랑, 초록)와 3개의 버튼, 가변저항을 이용하여 다양한 LED 제어 모드를 구현한 아두이노 기반 프로젝트입니다.
`TaskScheduler`와 `PinChangeInterrupt` 라이브러리를 활용해 상태 머신, 버튼 인터럽트, 시리얼 통신, PWM 밝기 조절 등의 기능을 구현하였습니다.

신호등 구현을 위해 빨간, 노란, 초록 총 3개의 LED가 사용되었고 각각의 LED는 9번, 10번, 11번 핀에 연결되어 있습니다. 그 다음은 빨간불만 계속 켜져있는 Emergency 상태, 모든 LED가 깜빡거리는 Blinking 상태, 기본 기능을 껐다 켜는 On/Off 상태 총 3가지 상태 변화를 위해 스위치 3개를 각 3번, 4번, 5번에 연결했습니다. 마지막으로 LED 밝기 세기 조절을 위해 가변저항을 준비하였고, 가변 저항은 A0핀에 연결했습니다.


### [Arduino]

Task 1: 주기적으로 LED를 켭니다. 이 주기는 Taskscheduler를 통해 제어합니다.

  기본적으로 빨강 (2초) -> 노랑 (0.5초) -> 초록(2초 동작 후 1초 동안 3번 블링크) -> 노랑 (0.5초) 사이클을 무한 반복합니다.
  
Task 2: 빨간 LED 계속 켜지는 Emergency Mode, 모든 LED 동시에 깜빡거리는 Blinking Mode, Power On/Off Mode 총 3가지 모드를 버튼을 통해 제어합니다.
  이때 버튼은 Interrupt 함수를 활용하여 제어합니다.
  
Task 3: 기본 동작 모드, 세 가지 모드에서 LED 밝기 조절을 할 수 있도록 가변 저항을 연결하고 이를 아날로그 신호 제어를 통해 조절합니다.

### 하드웨어 구성
### 핀 연결 상세

| 핀 번호 | 연결된 부품        | 설명 |
|--------|-------------------|------|
| D9     | 초록 LED(Green)    | PWM 출력 핀, 가변저항을 통해 밝기 제어 |
| D10    | 노랑 LED(Yellow)   | PWM 출력 핀, 가변저항을 통해 밝기 제어 |
| D11    | 빨강 LED(Red)      | PWM 출력 핀, 가변저항을 통해 밝기 제어 |
| D2     | 버튼3              | 모드 3 (LED 끔) 전환 버튼, 내부 풀업(Input Pull-up) |
| D3     | 버튼2              | 모드 2 (LED 깜빡임) 전환 버튼, 내부 풀업(Input Pull-up) |
| D4     | 버튼1              | 모드 1 (빨강 LED 고정) 전환 버튼, 내부 풀업(Input Pull-up) |
| A5     | 가변저항           | 0 ~ 1023 값을 읽어 LED 밝기 0 ~ 255로 매핑 |
| 5V/GND | 전원 및 접지       | 모든 부품에 전원 공급 및 회로 구성 |

### 내부 풀업 설명
버튼은 `INPUT_PULLUP` 모드로 설정되며, 디폴트 상태는 HIGH.

버튼 누르면 LOW로 변화 → 인터럽트 감지

### 소프트웨어 구조
1. Arduino 측 (하드웨어 제어)
라이브러리 사용: `TaskScheduler`, `PinChangeInterrupt`

**기능:**

- 상태 머신 기반 LED 제어

- 버튼 인터럽트를 통해 모드 전환

- 시리얼 통신으로 LED 상태 정보 송수신

- 가변저항으로 실시간 밝기 조절

**main.cpp 주요 구조**
`setup()`

  - 핀 모드 설정

  - `TaskScheduler` 초기화

  - 인터럽트 등록

  - 초기 Red Task 실행

`loop()`

  - TaskScheduler 실행

  - 시리얼 명령 수신 및 처리

**모드 구성**

- NORMAL: 빨강 → 노랑 → 초록 순서로 점등 및 시간 제어

- Red Mode: 빨강 LED만 지속 점등

- Blink Mode: 3색 LED 전부 깜빡임

- Power Off: 모든 LED OFF

**가변저항으로 밝기 조절**

- `analogRead()`로 0 ~ 1023 값 읽고, map() 함수로 0 ~ 255로 매핑하여 LED PWM 밝기 조절

---
### [p5.js]

본 프로젝트는 `p5.js`와 `Web Serial API`를 활용해 아두이노와 실시간으로 시리얼 통신을 수행하며, LED의 모드 상태, 밝기, 점등 시간을 웹 UI에서 설정하고 시각적으로 확인할 수 있는 기능을 제공합니다.

아두이노에서 전송한 시리얼 메시지를 Web Serial 인터페이스를 통해 모니터링합니다.

받은 메시지를 캔버스에 표시합니다.

Traffic Light Mode에선 각각의 신호등 상태를 나타냅니다
  NOMAL : 기본 동작 상태, Red Mode : 빨간 LED 계속 켜지는 Emergency 상태, Blink Mode : 모든 LED가 깜빡거리는 상태, Power On/Off : 신호등 꺼지고 켜짐 조절
  
Current LED에선 현재 활성화 중인 LED의 색깔을 텍스트로 표시하고 그 아래에 있는 원에선 현재 활성화 되고 있는 LED 색깔을 표시합니다.

Brightness에선 현재 LED의 밝기 정도를 0~255사이의 값으로 표시합니다.

슬라이더를 이용해 LED의 깜빡이는 주기를 조절하고, 해당 값을 시리얼 포트를 통해 아두이노로 전송합니다.
