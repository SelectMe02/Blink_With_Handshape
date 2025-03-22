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

    Serial.begin(9600);

    tRed.setInterval(redDuration);
    tRed.enable();
}

void loop() {
    ts.execute();
    serialReceive();
}

void sendStatusToWeb() {
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

    Serial.print(", Brightness:");
    Serial.println(brightness);
}

void serialReceive() {
    if (Serial.available()) {
        String command = Serial.readStringUntil('\n');
        command.trim();

        // LED 시간 설정
        if (command.startsWith("RED:")) {
            redDuration = command.substring(4).toInt();
            tRed.setInterval(redDuration);
            tRed.enable();
        }
        if (command.startsWith("YELLOW:")) {
            yellowDuration = command.substring(7).toInt();
            tYellow.setInterval(yellowDuration);
            tYellow2.setInterval(yellowDuration);
            tYellow.enable();
            tYellow2.enable();
        }
        if (command.startsWith("GREEN:")) {
            greenDuration = command.substring(6).toInt();
            tGreen.setInterval(greenDuration);
            tGreen.enable();
        }

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
    }
}

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
