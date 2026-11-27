# GymLog — Dynamic 12-Week Aesthetic & Posture Tracker (iOS & Android)

Cross-platform React Native (Expo SDK 58) app on the `android-app` branch while keeping the live web app on `main` intact.

## What's Inside
- **Dynamic Profile & Plan Engine (`src/engine/planGenerator.ts`):**
  - Takes **Age, Weight (kg), Height (cm), Sex, Experience (`Beginner` / `Intermediate` / `Advanced`), and Goal (`Recomp` / `Fat Loss` / `Lean Bulk`)** at Sign-Up or anytime in Settings.
  - Dynamically generates your training split (4-day Upper/Lower Foundation for Beginners, 6-day Aesthetic V-Taper + Anti-Slouch PPL for Intermediate/Advanced), set volumes, rest periods, joint-safety adjustments, **Zone 2 Heart Rate (`bpm`)**, **Daily Calorie & Deficit/Surplus targets**, **Daily Protein (`g/day` + budget food guide: Soya, Eggs, Dal, Chicken, Paneer/Whey)**, **Daily Hydration**, and **12-Week Weight/Waist/Posture Outlook**.
- **3-Tab Professional Interface:**
  - **Today:** Sticky header, 7-day strip with today dot, read-only day lock banner, collapsible form cues, progressive-overload `Last Time` rows, auto-starting floating rest timer with background notifications, cardio, steps, daily protein check-in, and Sunday weigh-in.
  - **Plan & Targets:** 12-week outlook hero card, protein/calorie/Zone 2 HR/hydration metrics, budget protein cheat sheet, and 12-week phase roadmap.
  - **Progress:** Custom SVG weight trend chart (`react-native-svg`) with 12-week target guide line, consistency KPIs, and weigh-in logger.
- **Offline-First Auth & Security (`expo-sqlite`, `expo-secure-store`, `expo-local-authentication`):**
  - Salted SHA-256 accounts, Face ID / Touch ID / Fingerprint quick unlock, 4-digit Quick PIN, multi-account support, and web-compatible JSON backup/restore.

## Commands
```bash
cd android-app
npm install
npx tsc --noEmit
npx expo start
```

### Build Binaries (iOS & Android) via EAS
```bash
npx eas-cli@latest build -p android --profile preview   # Android APK
npx eas-cli@latest build -p ios --profile preview       # Apple iOS build
```
