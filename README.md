# هجوم الكوابيس

لعبة ثلاثية الأبعاد (WebGL2 داخل WebView) مغلّفة بتطبيق Flutter للأندرويد.

## البناء
- محليًا أو في Klencod: `flutter pub get` ثم `flutter build apk --release`
- أو من GitHub: Actions ← Build Flutter APK ← Run workflow

## هيكل المشروع
- `lib/main.dart` : غلاف Flutter (شاشة كاملة أفقية، زر الرجوع، حفظ احتياطي)
- `assets/game/index.html` : اللعبة كاملة في ملف واحد (جاهزة)
- `game_src/` : الكود المصدري للعبة. لإعادة التجميع: `python3 game_src/build.py assets/game/index.html`
- `android/` : إعدادات أندرويد (الحزمة com.wallguard.game)

## ملاحظات
- التوقيع بمفتاح debug ويصلح للتثبيت المباشر.
- مفاتيح التجربة على الكمبيوتر: WASD حركة، مسافة قفز، Q/E خطاف يسار/يمين، Shift غاز، F ضربة.
