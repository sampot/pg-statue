# pg-statue

**一二三木頭人**：背對時按住「前進」、回頭立刻立定；與 1–2 位電腦小孩搶先衝線。純前端，無建置步驟。

致敬經典童玩「紅綠燈／一二三木頭人」，非任一商業作品復刻。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **SAM**（`index.html` 入口）。

## 一鍵開 SAM 小

**[一鍵開 SAM 小](https://play.samkuo.me/?open=sampot/pg-statue&name=一二三木頭人&fresh=1)**

```
https://play.samkuo.me/?open=sampot/pg-statue&name=一二三木頭人&fresh=1
```

同源會重用本機已匯入的沙盒；`fresh=1` 強制新建。

## 試玩（本機）

```bash
npx --yes serve .
# 或
python3 -m http.server 8080
```

## 操作

| 操作 | 說明 |
| --- | --- |
| **開局** | 開始新局 |
| **前進**（按住） | 裁判背對時前進；回頭必須放開 |
| **音效** | 開／關 Web Audio 音效 |

## 規則摘要

- 裁判背對（綠燈）時可按住「前進」；喊「一、二、三」期間亦可動
- 喊「木頭人！」回頭（紅燈）必須立刻停止；仍在移動會被逮
- 被逮扣 1 命並退回起點；共 3 命
- 與小橙、小紫競速，先衝線者勝
- 最佳完賽時間與勝場存於 `localStorage` 鍵 **`pg-statue-best`**

## License

MIT
