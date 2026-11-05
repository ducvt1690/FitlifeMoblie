# Expo Mobile verification — 2026-11-05

## Delivered

- Kept Expo Router, React Native, the existing theme/components and role-protected navigation.
- Trainer: editable title/instructions/category/duration/calories/level; delete/archive confirmation; stable assignment UUID across retries; per-student assignment notes; assignment cancellation reason; consent disconnect; invitation list/expiry/revoke; student progress with pagination and feedback.
- Trainer lists use backend search/status/pagination; templates and students expose sorting. Assignments use the backend's default chronological order.
- Member: assignment inbox accessible directly on Home and Profile; trainer/date/instructions/note/status/feedback; completion and connection consent actions. Added API-backed challenge participation/check-in and reward redemption/history in Profile.
- Admin: challenge/reward create/edit/deactivate, payment/redemption/detail lookup, audit log detail/account/action/date filters, revenue date range and separate Premium/Coin/other totals from backend. Account changes retain confirmation/reason and show success feedback.
- Central authenticated call clears revoked/expired sessions, prevents a stale request from clearing a newer login, refreshes role on foreground and periodically, and shows a readable sign-in notice. Trainer/Admin previously bypassed this path; now they use it.
- TextField inputs expose their label to native accessibility tools.
- New common management hook handles stale responses, loading/error/empty states, total counts and page boundaries. Dangerous actions require confirmation.

## Executed checks

| Check | Result | Evidence |
|---|---|---|
| `npm --prefix frontend run check` | PASS; dependencies compatible | `output/mobile-package-check.log` |
| `npx expo-doctor` from frontend | PASS 20/20 | `output/mobile-expo-doctor.log` |
| `npm --prefix frontend run build` | PASS Android/iOS/Web export | `output/mobile-export-build.log`, `output/mobile-export/metadata.json` |
| Android native UI + HTTP/DB verification | PASS 14 checks; final failed0, blocked0 | `output/mobile-native-test-result.json` |
| Independent expiry UI scenario | PASS after rerun on fresh disposable API5500 | The uniquely identified native session was expired in the local test DB; protected API caused sign-out and readable notice |
| Dependency security audit | 7 moderate; 0 high; 0 critical | `output/mobile-dependency-audit.json` |

Dependencies were initially incompatible (6 packages). Expo-compatible updates fixed this; no forced downgrade or ignored doctor checks were used. Remaining npm advisories concern Expo/tunnel tooling and transitive glob/minimatch/uuid. npm's proposed Expo downgrade would break the current SDK and was not applied.

The 14 native assertions cover:

1. Empty template validation.
2. Template creation with all fields persisted.
3. Template title/duration edit persisted.
4. Assignment with member note persisted.
5. Single assignment cancellation with reason persisted.
6. Student disconnect removes active consent.
7. Admin renders Premium and Coin totals separately.
8. Challenge creation persists target and reward.
9. Challenge deactivation after confirmation.
10. Reward creation persists price/category.
11. Member opens assignment inbox and completion persists.
12. Member sees instructions, note and feedback.
13. Deleting only the identified native test session causes protected API401, clears client auth state, and displays the session-ended notice.
14. Expiring only the identified native test session causes protected API rejection and returns the app to sign-in state.

Initial member-feedback assertion used the wrong scroll direction; the reusable test driver was corrected and the full member scenario reran successfully. The expiry assertion initially attempted navigation after the app had already signed out; this was corrected, then further login attempts hit the expected limiter. The limiter was preserved. A final rerun on the fresh disposable integration runtime passed the independent expiry scenario; all 14 final assertions passed.

Screenshots: `output/mobile-admin-revenue.png`, `output/mobile-member-assignment.png`, `output/mobile-session-revoked.png`, `output/mobile-session-expired.png`. Native UI action traces: `output/mobile-native-actions.jsonl` and last UI dump `output/mobile-ui.xml`.

## Reproduce integration on Android emulator

Start the root disposable integration runtime first. It writes `output/integration-runtime.local.json`; this file contains temporary local credentials and must remain ignored. Metro reads only its API URL; the native test driver reads its temporary test accounts. No credentials are embedded in source.

```powershell
adb reverse tcp:5500 tcp:5500
adb reverse tcp:8081 tcp:8081
npm --prefix frontend run start:integration
adb shell am start -a android.intent.action.VIEW -d exp://127.0.0.1:8081
```

In a second terminal, with the emulator at the signed-out landing screen:

```powershell
node frontend/scripts/mobile-ui.js login trainer
node frontend/scripts/mobile-ui.js tap 'Tạo bài tập mẫu'
node frontend/scripts/mobile-ui.js trainer-template-smoke
node frontend/scripts/mobile-ui.js trainer-assignment-smoke
node frontend/scripts/mobile-ui.js logout
node frontend/scripts/mobile-ui.js login admin
node frontend/scripts/mobile-ui.js admin-catalog-smoke
node frontend/scripts/mobile-ui.js member-session-smoke
node frontend/scripts/mobile-ui.js session-expiry-smoke
```

The runner uses real native UIAutomator elements; writes to the database only target the explicitly guarded disposable local integration database. Fixture APIs create consent/assignment data for member tests. Session revocation deletes only the unique session added by that native login, preserving unrelated sessions. Do not run unrelated logins to the same fixture account during that assertion. A fresh runtime avoids exhausting login limits. The optional `trainer-invite-smoke` command is available but was not executed or counted in the final14 passes. The final expiry rerun used a fresh runtime to avoid the limiter reached by earlier repeated suites.

Normal mobile development: `npm --prefix frontend start`. A physical phone uses the computer's LAN API URL in `EXPO_PUBLIC_API_URL` and must reach the same backend as Web. The existing ignored `.env.local` was preserved. The integration script explicitly uses API5500 and Metro8081; existing servers5000/8082 were left intact.

## Limits and handoff

- Android emulator API36 / Expo Go ran the native tests. Physical-phone Wi-Fi access and iOS runtime remain UNVERIFIED; iOS export passed on Windows.
- Expo Go warns that remote push notifications require a development build; this is an existing SDK restriction, not a failed core fitness flow.
- Payment gateway checkout and actual money settlement require configured gateway credentials; no fake payment success was introduced.
- Native UI coverage is representative, not every combination of filter, CRUD form and device size. Backend/API and standalone Web reports provide the broader regression coverage.
- Metro8081 and the Android emulator were left running. Native test data belongs to the disposable runtime and may be replaced when that runtime restarts.
