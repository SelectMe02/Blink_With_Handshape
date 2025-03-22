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

