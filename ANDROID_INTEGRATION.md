# Connecting your existing Kotlin/Jetpack Compose app

**IMPORTANT:** The original RentMateFrontend.zip is a standalone demonstration. Installing/deploying this backend does **not** automatically connect its buttons or screens. A new Android build with networking code is necessary.

1. In `app/src/main/AndroidManifest.xml`, add `<uses-permission android:name="android.permission.INTERNET" />` outside `<application>`.
2. Add Retrofit + OkHttp + Kotlin serialization/Gson dependencies to `app/build.gradle.kts`.
3. Set the API base URL to `https://YOUR-SERVICE.onrender.com/api/` (never embed the Neon connection string).
4. Replace demo sign-in with `POST auth/login`, registration with `POST auth/register`, and store the JWT securely (Android Keystore-backed encrypted storage is preferred).
5. Send `Authorization: Bearer <token>` for protected calls. Handle HTTP 401 by returning to login.
6. Fetch `GET dashboard` and `GET rent/charges` when dashboard/rent screen opens. Format integer cents to ZAR; show `paid_cents` and `outstanding_cents` from the API.
7. For chores, call `GET/POST households/{id}/chores` and `PATCH chores/{id}`; do not rely on local `remember` state.
8. For messages, call `GET/POST households/{id}/messages`; for announcements call `GET households/{id}/announcements`.
9. For payment screen, call `POST payments/simulate`. This is a simulated transaction: the server does not change verified balances. User-facing copy should **clearly indicate no real money was transferred**, even if you choose not to put the word "demo" on the UI.
10. For in-app notifications, poll `GET notifications` while app is in foreground and show unread count and inbox. Mark opened items with `PATCH notifications/{id}/read`.
11. For real phone notifications when the app is closed, add Firebase Cloud Messaging (FCM) to Android, store device tokens in the backend, and send push messages using Firebase Admin SDK. **Not included here.**
12. Reminder scheduling requires an always-on Render service or external cron worker. Free sleeping services cannot guarantee reminders.

**Never** put `DATABASE_URL`, `JWT_SECRET`, or manager credentials in Android code.
