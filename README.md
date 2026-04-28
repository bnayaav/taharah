# טהרת המשפחה - PWA

אפליקציית מעקב טהרת המשפחה בעברית עם ניתוח כתמים בעזרת AI.

## תכולה

- **PWA** - מבוסס HTML/JS, נפתח בפלאפון ופועל אופליין
- **חישובים הלכתיים** - וסת החודש, עונה בינונית, וסת ההפלגה
- **מעקב מחזור** - מהפסק טהרה דרך שבעה נקיים ועד טבילה
- **AI לכתמים** - העלאת תמונה → ניתוח ויזואלי → רמת חשש
- **פרטיות** - הכל ב-localStorage, התמונות לא נשמרות בשרת

## מבנה

```
taharah/
├── public/                    # סטטי - מתפרס ל-Cloudflare Pages
│   ├── index.html             # האפליקציה כולה
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   ├── icon-192.png           # אייקון
│   ├── icon-512.png           # אייקון גדול
│   └── _headers               # כותרות אבטחה
├── functions/api/
│   └── analyze.js             # Cloudflare Pages Function - פרוקסי ל-Claude API
├── .github/workflows/
│   └── deploy.yml             # דיפלוי אוטומטי
└── README.md
```

## דיפלוי - שלב אחר שלב

### 1. צרי repo חדש ב-GitHub
- שם: `taharah` (או כל שם אחר)
- העלי את כל הקבצים מהתיקייה הזו

### 2. צרי פרויקט ב-Cloudflare Pages
1. היכנסי ל-[Cloudflare Dashboard](https://dash.cloudflare.com)
2. Workers & Pages → Create → Pages → Connect to Git
3. בחרי את ה-repo
4. Build settings:
   - **Build command:** *(ריק)*
   - **Build output directory:** `public`
5. Save and Deploy

### 3. הוסיפי את משתנה הסביבה
ב-CF Pages → Settings → Environment Variables:
- שם: `ANTHROPIC_API_KEY`
- ערך: המפתח שלך מ-[console.anthropic.com](https://console.anthropic.com)
- Production + Preview

חשוב: בלי המפתח הזה, ניתוח התמונות לא יעבוד (האפליקציה תיפול אוטומטית לחישוב לפי כללים).

### 4. (אופציונלי) GitHub Actions
אם את רוצה שכל push יעדכן את האתר אוטומטית:

ב-GitHub repo → Settings → Secrets and variables → Actions:
- `CLOUDFLARE_API_TOKEN` - תיצרי ב-CF: My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template
- `CLOUDFLARE_ACCOUNT_ID` - מופיע ב-CF Dashboard בתפריט הימני

## עלות

- **Cloudflare Pages**: בחינם עד 500 דיפלויים בחודש ו-100K בקשות לפונקציה ביום
- **Anthropic API**: כ-$0.003 לבדיקת תמונה (תלוי בגודל), חודש ממוצע ~$0.50

## פרטיות

- כל המחזורים, הכתמים וההגדרות נשמרים אך ורק ב-`localStorage` של הדפדפן
- התמונות נשלחות ישירות ל-Claude API דרך הפרוקסי, לא נשמרות בשום מקום
- הפונקציה ב-Cloudflare לא מבצעת לוג של תמונות
- ייצוא/ייבוא נעשה על המכשיר בלבד

## בטיחות הלכתית

האפליקציה היא **כלי עזר ויזואלי בלבד**. כל פסק הלכה למעשה צריך לבוא מרב מורה הוראה. AI לא מחליף שאלת רב.

## פיתוח מקומי

```bash
# התקנת wrangler
npm install -g wrangler

# הרצה מקומית
wrangler pages dev public

# הגדר משתנה סביבה
echo "ANTHROPIC_API_KEY=sk-ant-..." > .dev.vars
```

## הוספות אפשריות בעתיד

- [ ] התראות push יום לפני פרישה
- [ ] שילוב עם זמני שקיעה לפי GPS לזיהוי "עונה" אוטומטי
- [ ] ייצוא לוח שנה (ICS) של תאריכי פרישה
- [ ] תמיכה במשתמשת מרובות (סנכרון ענן עם Cloudflare D1)
- [ ] מצב למורה הוראה (סטטיסטיקות, ייעוץ)
