# טהרת המשפחה - PWA

אפליקציה למעקב הלכות נידה וטהרת המשפחה: וסת החודש, עונה בינונית, וסת ההפלגה, הפסק טהרה, שבעה נקיים, וטבילה. כולל בודק כתמים מבוסס AI עם תמונה, התחברות חשבון וסנכרון, וחיבור זוגי.

## תכונות

- **מעקב מחזורים** עם תאריכי פרישה צפויים (וסת החודש, עונה בינונית, הפלגה)
- **ספירת שבעה נקיים** ויזואלית
- **בודק כתמים** - ניתוח רגיל + ניתוח AI על תמונה (Claude Vision)
- **התחברות** - אימייל+סיסמה או Google OAuth
- **חיבור זוגי** - האישה מזמינה את הבעל בקוד 6 ספרות, הבעל רואה תאריכי פרישה (לא בדיקות אישיות אלא אם האישה אישרה)
- **PWA** - עובד אופליין, ניתן להוסיף למסך הבית
- **מצב מקומי** - אפשרות להשתמש בלי חשבון, נתונים נשמרים רק במכשיר

## פריסה

### 1. יצירת מסד הנתונים D1

ב-Cloudflare Dashboard:
1. **Workers & Pages** → **D1**
2. **Create database** → שם: `taharah-db`
3. אחרי היצירה, פתחי את הטאב **Console**
4. הדביקי את התוכן של `migrations/0001_init.sql` והריצי

### 2. חיבור ה-DB לפרויקט Pages

1. **Workers & Pages** → הפרויקט `taharah` → **Settings**
2. **Functions** → **D1 database bindings** → **Add binding**:
   - Variable name: `DB`
   - D1 database: `taharah-db`
3. שמירה ופריסה מחדש

### 3. משתני סביבה (Secrets)

**Settings** → **Environment variables** → **Production** + **Preview**:

| שם | ערך | חובה? |
|---|---|---|
| `ANTHROPIC_API_KEY` | sk-ant-... | כן (לזיהוי תמונות) |
| `GOOGLE_CLIENT_ID` | (אופציונלי) | רק אם רוצים Google login |
| `GOOGLE_CLIENT_SECRET` | (אופציונלי) | רק אם רוצים Google login |

יש לסמן **Encrypt** לכל המפתחות.

### 4. (אופציונלי) הגדרת Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth 2.0 Client ID** → **Web application**
3. **Authorized redirect URIs**: `https://taharah.pages.dev/api/auth/google/callback`
4. הוסיפי את Client ID ו-Client Secret ב-CF Pages Secrets

אם לא מוגדר, הכפתור "המשך עם Google" יחזיר שגיאה. אימייל+סיסמה תמיד עובד.

## מבנה הפרויקט

```
taharah/
├── public/
│   ├── index.html      # האפליקציה
│   ├── manifest.json
│   ├── sw.js
│   └── icon-*.png
├── functions/
│   ├── _lib.js                       # auth, hashing, helpers
│   └── api/
│       ├── analyze.js               # AI stain analysis
│       ├── auth/{signup,login,logout,me}.js
│       ├── auth/google/{start,callback}.js
│       ├── cycles/{index,[id]}.js
│       ├── stains/{index,[id]}.js
│       ├── couple/{invite,accept,index}.js
│       └── settings.js
├── migrations/
│   └── 0001_init.sql
└── wrangler.toml
```

## שימוש בקוד הזמנה זוגי

**האישה:** הגדרות → "הזמנת בן זוג" → מקבלת קוד בן 6 ספרות (תקף 24 שעות) → שולחת לבעלה.

**הבעל:** נרשם באפליקציה → הגדרות → "הצטרפות לבת זוג" → מזין את הקוד.

הבעל רואה את תאריכי הפרישה והטבילה (קריאה בלבד). בדיקות כתמים פרטיות כברירת מחדל - האישה יכולה להפעיל שיתוף ידני.

## אזהרה הלכתית

**האפליקציה היא כלי עזר בלבד**. כל קביעה הלכתית - גם "מתי לפרוש", גם "האם הכתם טמא", וגם "מתי לטבול" - חייבת להיפסק על ידי רב מורה הוראה.
