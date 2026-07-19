# دليل تشغيل اختبار الثيمات محلياً (Windows)

خطوات يدوية، وحدة وحدة. الجزء (أ) مرة واحدة فقط. الجزء (ب) كل ما تبين تختبرين ثيم.
كل الأوامر في **PowerShell**.

> 📁 **مهم:** كل ثيم تختبرينه ينحفظ في مجلد خاص فيه: `runs\<theme_id>\`
> (فيه: `validate.json` + تقرير HTML + سكرين شوتس). فما يطوس ثيم على ثيم.

---

## الجزء (أ) — التجهيز (مرة واحدة فقط)

### 1) ثبّتي Python
- من: https://www.python.org/downloads/  — أثناء التثبيت علّمي ✅ "Add Python to PATH".
- تأكيد:
```powershell
py --version
```

### 2) ثبّتي Node.js
- نسخة **LTS** من: https://nodejs.org/  (خلّي "Add to PATH" مفعّلة).
- **أغلقي PowerShell وافتحي وحدة جديدة** (عشان PATH يتحدّث).
- تأكيد:
```powershell
node --version
npm --version
```
لو ما طلعوا أرقام، أعيدي تشغيل الجهاز مرة.

### 3) ادخلي مجلد المشروع
```powershell
cd "C:\Users\noraa\AppData\Roaming\Claude\local-agent-mode-sessions\b591465a-646a-47fd-979f-6b2ab8a4cf52\2d9d18c1-f72e-42db-af0a-2814bb7ca73f\local_18cc516d-24d1-4583-87bd-785a095b941c\outputs\zid-theme-qa"
```

### 4) ثبّتي مكتبات المشروع
```powershell
py -m pip install beautifulsoup4
npm install
npx playwright install chromium
```
آخر أمر ينزّل متصفح الاختبار (~100 ميقا، مرة وحدة).

✅ خلص الجزء (أ).

---

## الجزء (ب) — اختبار ثيم (كرّريه لكل ثيم، في نفس النافذة)

### 1) حدّدي الثيم
```powershell
$env:PREVIEW_BASE = "https://i1o0np.dev.zid.store"
$env:THEME_ID     = "8f46acc0-01d6-4dcb-b1f9-873e8684f0a6"
```
- `PREVIEW_BASE` = رابط البريفيو. &nbsp; `THEME_ID` = اللي بعد `?theme=` في الرابط.

### 2) Layer 1 — الفحص البنيوي
```powershell
py validate_check.py --preview $env:PREVIEW_BASE --theme $env:THEME_ID
```
النتيجة تنحفظ تلقائياً في `runs\<theme_id>\validate.json`.

### 3) Layer 2 — الاختبار الوظيفي والبصري
```powershell
npx playwright test
```
أول ما يبدأ بيطبع:
```
>> Testing preview: https://i1o0np.dev.zid.store  (theme: 8f46acc0-...)
>> Results will be saved in: runs/8f46acc0-...
```
تأكّدي إن الموقع **هو الصح**. لو طلع خطأ إن `PREVIEW_BASE` مو مضبوط → رجعي خطوة 1 في نفس النافذة.

### 4) شوفي التقرير المرئي (سكرين شوتس + تفاصيل)
```powershell
npx playwright show-report runs\$env:THEME_ID\playwright-report
```

### 5) (اختياري) Layer 3 — الحسم (تجربة بدون إرسال)
```powershell
node scripts\finalize.js
```
يطبع الإيميلات/سلاك/الحالة اللي **كان بيرسلها** — ما يرسل شي فعلياً. المخرجات في `runs\<theme_id>\out\`.

---

## اختبار ثيم ثاني
كرّري الجزء (ب) بس، وغيّري القيمتين في خطوة 1. الثيم الجديد يصير له مجلده الخاص، والثيم القديم يبقى محفوظ.

### 6) (اختياري) خلّي التقرير يوصلك على الإيميل (بأي نتيجة)
يبني تقرير HTML بملف واحد (فيه العدّادات والأخطاء والسكرين شوتس) ويرسله لك مرفق — نجح أو فشل.

تحتاجين حساب SMTP (مثلاً Gmail مع App Password). في نفس النافذة:
```powershell
$env:REPORT_TO = "nora.alareer@zid.sa"
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "your@gmail.com"
$env:SMTP_PASS = "app-password"     # كلمة مرور تطبيق، مو كلمة مرور الحساب
node scripts\email_report.js
```
لو ما ضبطتي SMTP، الأمر يبني التقرير بس ويقول لك مكانه (`runs\<theme_id>\report.html`) تفتحينه يدوياً.

---

## أشياء طبيعية مو أخطاء
- **تيستات "skipped":** اللي تحتاج المتجر التجريبي أو علامات `data-testid` أو الـpreset — تتخطّى برسالة واضحة بدل نتيجة خاطئة.
- **تحذيرات console:** أخطاء الكونسول من أدوات خارجية (تحليلات) تظهر كتحذير مو فشل. لجعلها فشل على المتجر التجريبي: `$env:CONSOLE_STRICT="1"` قبل التشغيل.

## لو صار خطأ
انسخي نص الخطأ وابعثيه.
