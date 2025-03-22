#include <Arduino.h>
#include <TaskScheduler.h>
#include <PinChangeInterrupt.h>

const int red = 11;
const int yellow = 10;
const int green = 9;
const int switch1 = 3; 
const int switch2 = 4; 
const int switch3 = 5;
const int potentiometer = A0;

Scheduler ts;

void taskRed();
void taskYellow();
void taskGreen();
void blinkGreen();
void finishGreen();
void taskYellow2();
void blinkAll();
void adjustBrightness();

void switch1_ISR();
void switch2_ISR();
void switch3_ISR();

// ───────────────────────────────
// 시리얼 통신 관련 함수 선언
// ───────────────────────────────
// sendStatusToWeb()와 serialReceive()는 시리얼 통신을 통해 외부와
// 데이터를 주고받기 위한 핵심 함수입니다.
void sendStatusToWeb();
void serialReceive();

bool redMode = false;      
bool blinkMode = false;    
bool powerOff = false;     

bool stateRed = false;
bool stateYellow = false;   
bool stateGreen = false;
bool stateYellow2 = false;
bool stateblinkGreen = false; 

int redDuration = 2000;
int yellowDuration = 500;
int greenDuration = 2000;
int brightness = 255;

Task tRed(0, TASK_ONCE, &taskRed, &ts, false);
Task tYellow(0, TASK_ONCE, &taskYellow, &ts, false);
Task tGreen(0, TASK_ONCE, &taskGreen, &ts, false);
Task tBlinkGreen(300, 6, &blinkGreen, &ts, false);
Task tFinishGreen(100, TASK_ONCE, &finishGreen, &ts, false);
Task tYellow2(0, TASK_ONCE, &taskYellow2, &ts, false);
Task tBlinkAll(500, TASK_FOREVER, &blinkAll, &ts, false);
Task tAdjustBrightness(200, TASK_FOREVER, &adjustBrightness, &ts, true);
Task tSendStatus(500, TASK_FOREVER, &sendStatusToWeb, &ts, true);

void setup() {
    pinMode(red, OUTPUT);
    pinMode(yellow, OUTPUT);
    pinMode(green, OUTPUT);
    pinMode(switch1, INPUT_PULLUP);
    pinMode(switch2, INPUT_PULLUP);
    pinMode(switch3, INPUT_PULLUP);

    attachPCINT(digitalPinToPCINT(switch1), switch1_ISR, FALLING);
    attachPCINT(digitalPinToPCINT(switch2), switch2_ISR, FALLING);
    attachPCINT(digitalPinToPCINT(switch3), switch3_ISR, FALLING);

    Serial.begin(9600);  // 시리얼 통신 시작: 9600 bps

    tRed.setInterval(redDuration);
    tRed.enable();
}

void loop() {
    ts.execute();
    serialReceive();  // 시리얼 데이터를 읽고 명령 처리
}

// ───────────────────────────────
// 1. sendStatusToWeb():
//    - 현재 모드, LED 상태, 밝기 정보를 문자열 형태로 구성하여
//      시리얼 포트를 통해 전송합니다.
//    - 전송 형식은 "MODE:모드, LED:상태, Brightness:값"입니다.
//    - 이 정보를 웹 서버나 외부 시스템에서 읽어 현재 시스템의 상태를
//      모니터링하거나 제어할 수 있습니다.
// 
// 2. serialReceive():
//    - Serial.available()를 통해 수신 버퍼에 데이터가 있는지 확인합니다.
//    - '\n' 문자가 나올 때까지 문자열을 읽어들여 한 줄의 명령으로 취급합니다.
//    - 읽은 문자열의 앞뒤 공백을 제거한 후, 아래와 같이 처리합니다:
//         * "RED:"로 시작하는 명령: 빨간 LED 지속 시간(redDuration)을 설정.
//         * "YELLOW:"로 시작하는 명령: 노란 LED 지속 시간(yellowDuration)을 설정.
//         * "GREEN:"로 시작하는 명령: 초록 LED 지속 시간(greenDuration)을 설정.
//         * "BTN1", "BTN2", "BTN3": 해당 버튼 기능을 직접 실행(각 ISR 호출).
//    - 이를 통해 외부에서 시리얼로 명령을 보내 시스템의 동작을 제어할 수 있습니다.
// ───────────────────────────────

void sendStatusToWeb() {
    // 모드 정보 전송: 현재 모드에 따라 문자열 결정
    Serial.print("MODE:");
    if (redMode) {
        Serial.print("Red Mode");
    } else if (blinkMode) {
        Serial.print("Blink Mode");
    } else if (powerOff) {
        Serial.print("Power OFF");
    } else {
        Serial.print("NORMAL");
    }

    // LED 상태 정보 전송
    Serial.print(", LED:");
    if (stateRed) {
        Serial.print("Red");
    } else if (stateYellow || stateYellow2) {
        Serial.print("Yellow");
    } else if (stateGreen || stateblinkGreen) {
        Serial.print("Green");
    } else if (blinkMode) {
        Serial.print("Blinking");
    } else {
        Serial.print("OFF");
    }

    // 밝기 정보 전송 (마지막에 개행 문자 추가)
    Serial.print(", Brightness:");
    Serial.println(brightness);
}

void serialReceive() {
    // 시리얼 버퍼에 데이터가 있으면 처리
    if (Serial.available()) {
        // 개행 문자('\n')까지 읽어 한 줄의 문자열로 저장
        String command = Serial.readStringUntil('\n');
        command.trim();  // 앞뒤 공백 제거

        // LED 지속 시간 변경 명령 처리:
        // "RED:" 이후의 문자열을 숫자로 변환하여 redDuration 업데이트
        if (command.startsWith("RED:")) {
            redDuration = command.substring(4).toInt();
            tRed.setInterval(redDuration);
            tRed.enable();
        }
        // "YELLOW:" 이후의 문자열을 숫자로 변환하여 yellowDuration 업데이트
        if (command.startsWith("YELLOW:")) {
            yellowDuration = command.substring(7).toInt();
            tYellow.setInterval(yellowDuration);
            tYellow2.setInterval(yellowDuration);
            tYellow.enable();
            tYellow2.enable();
        }
        // "GREEN:" 이후의 문자열을 숫자로 변환하여 greenDuration 업데이트
        if (command.startsWith("GREEN:")) {
            greenDuration = command.substring(6).toInt();
            tGreen.setInterval(greenDuration);
            tGreen.enable();
        }

        // 버튼 명령 처리: 외부 명령으로 BTN1, BTN2, BTN3 명령이 오면
        // 해당하는 ISR 함수를 직접 호출하여 모드 전환 등의 기능을 수행
        if (command.startsWith("BTN1")) {
            switch1_ISR();
        }
        if (command.startsWith("BTN2")) {
            switch2_ISR();
        }
        if (command.startsWith("BTN3")) {
            switch3_ISR();
        }
    }
}

// ───────────────────────────────
// 이하 LED 제어 및 모드 전환 함수
// ───────────────────────────────

void taskRed() {
    if (redMode || blinkMode || powerOff) return;
    analogWrite(red, 255);
    analogWrite(yellow, 0);
    analogWrite(green, 0);
    stateYellow2 = false;
    stateRed = true;
    tYellow.setInterval(yellowDuration);
    tYellow.restartDelayed(redDuration - 100);
    Serial.println("Red is running...");
}

void taskYellow() {
    if (redMode || blinkMode || powerOff) return;
    analogWrite(red, 0);
    analogWrite(yellow, 255);
    analogWrite(green, 0);
    stateRed = false;
    stateYellow = true;
    tGreen.setInterval(greenDuration);
    tGreen.restartDelayed(yellowDuration - 10);
    Serial.println("Yellow is running...");
}

void taskGreen() {
    if (redMode || blinkMode || powerOff) return;
    analogWrite(red, 0);
    analogWrite(yellow, 0);
    analogWrite(green, 255);
    stateYellow = false;
    stateGreen = true;
    tBlinkGreen.restartDelayed(greenDuration - 100);
    Serial.println("Green is running...");
}

void blinkGreen() {
    if (redMode || blinkMode || powerOff) return;
    stateGreen = false;
    stateblinkGreen = true;
    static bool isOn = true;
    isOn = !isOn;
    analogWrite(green, isOn ? 255 : 0);
    Serial.println(isOn ? "Green Blinking: ON" : "Green Blinking: OFF");
    if (tBlinkGreen.isLastIteration()) {
        tFinishGreen.restartDelayed(90);
    }
}

void finishGreen() {
    if (redMode || blinkMode || powerOff) return;
    Serial.println("Green OFF, switching to Red");
    analogWrite(green, 0);
    tYellow2.restartDelayed(90);
}

void taskYellow2() {
    if (redMode || blinkMode || powerOff) return;
    analogWrite(red, 0);
    analogWrite(yellow, 255);
    analogWrite(green, 0);
    stateblinkGreen = false;
    stateYellow2 = true;
    tRed.restartDelayed(yellowDuration - 10);
    Serial.println("Yellow2 is running...");
}

void blinkAll() {
    static bool isOn = true;
    isOn = !isOn;
    analogWrite(red, isOn ? 255 : 0);
    analogWrite(yellow, isOn ? 255 : 0);
    analogWrite(green, isOn ? 255 : 0);
    Serial.println(isOn ? "Blink Mode: ON" : "Blink Mode: OFF");
}

void adjustBrightness() {
    int potValue = analogRead(potentiometer);
    brightness = map(potValue, 0, 1023, 0, 255);

    if (!redMode && !blinkMode && !powerOff) {
        if (stateRed) {
            analogWrite(red, brightness);
        } else if (stateYellow || stateYellow2) {
            analogWrite(yellow, brightness);
        } else if (stateGreen || stateblinkGreen) {
            analogWrite(green, brightness);
        }
    }
    else if (redMode){
        analogWrite(red, brightness);
        analogWrite(yellow, 0);
        analogWrite(green, 0);
    } 
    else if (blinkMode) {
        analogWrite(red, brightness);
        analogWrite(yellow, brightness);
        analogWrite(green, brightness);
    }
    else if (powerOff){
        analogWrite(red, 0);
        analogWrite(yellow, 0);
        analogWrite(green, 0);
    }

    sendStatusToWeb();
}

void switch1_ISR() {
    if (!redMode) {
        redMode = true;
        blinkMode = false;
        powerOff = false;
        tBlinkAll.disable();
    } else {
        redMode = false;
    }
    Serial.println(redMode ? "Red Mode: ON" : "Red Mode: OFF");

    if (redMode) {
        analogWrite(red, 255);
        analogWrite(yellow, 0);
        analogWrite(green, 0);
    } else {
        tRed.restart();
    }

    sendStatusToWeb();
}

void switch2_ISR() {
    if (!blinkMode) {
        blinkMode = true;
        redMode = false;
        powerOff = false;
        tRed.disable();
    } else {
        blinkMode = false;
    }
    Serial.println(blinkMode ? "Blink Mode: ON" : "Blink Mode: OFF");

    if (blinkMode) {
        analogWrite(red, 0);
        analogWrite(yellow, 0);
        analogWrite(green, 0);
        tBlinkAll.enable();
    } else {
        tBlinkAll.disable();
        tRed.restart();
    }

    sendStatusToWeb();
}

void switch3_ISR() {
    if (!powerOff) {
        powerOff = true;
        redMode = false;
        blinkMode = false;
        tRed.disable();
        tBlinkAll.disable();
    } else {
        powerOff = false;
    }
    Serial.println(powerOff ? "Power OFF" : "Power ON");

    if (powerOff) {
        analogWrite(red, 0);
        analogWrite(yellow, 0);
        analogWrite(green, 0);
    } else {
        tRed.restart();
    }

    sendStatusToWeb();
}
