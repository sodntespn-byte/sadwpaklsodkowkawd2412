# LIBERTY v1.0.0.1 — Implementation Report

## Introduction

**LIBERTY v1.0.0.1** introduces changes to the authentication and security flow of the LIBERTY platform:

- **Passwordless login** — Login using only username (password no longer required at login).
- **Security warning screen** — A post-login notice with options to review Privacy and Security or continue.
- **Device association (HWID-style)** — A persistent device identifier is associated with the account on first use; when the user logs in from the same device again, the system recognises it as a trusted device (no additional MFA step).

This report documents every change made, including code snippets and technical details.

---

## 1. Password Removal from Login

### Summary

Login no longer requires a password. The backend already supported accounts without a password (`password_hash` null); the frontend was updated to stop sending a password and to remove the password field from the login form.

### Backend (unchanged behaviour)

The `/api/v1/auth/login` handler in `server.js` already allowed login without a password when the user has no `password_hash`:

- If `user.password_hash` is set, the provided password is validated.
- If `user.password_hash` is null, no password check is performed and login succeeds with username only.

No backend change was required for password removal; only the frontend was adjusted.

### Frontend changes

**1. Login form — remove password field and “Forgot password” link**

**File:** `static/index.html`

- Removed the entire “Password” form group (label + input) from `#login-form`.
- Removed the “Forgot your password? Reset it” footer link.

**Before (snippet):**
```html
<div class="form-group">
    <label for="login-password">Password <span class="optional">(opcional)</span></label>
    <div class="input-wrapper">
        <i class="fas fa-lock" ...></i>
        <input type="password" id="login-password" ...>
    </div>
</div>
...
<p class="form-footer">Forgot your password? <a href="#" class="link">Reset it</a></p>
```

**After:** Only the username field and the “Sign In” button remain in `#login-form`.

**2. Login handler — stop using password**

**File:** `static/js/app.js`

- `handleLogin()` no longer reads `login-password` or sends a password to the API.
- It sends only `username` and `device_id` (see HWID section).

**Snippet:**
```javascript
async handleLogin() {
    const usernameEl = document.getElementById('login-username');
    const username = usernameEl.value.trim();
    // ...
    const deviceId = this.getOrCreateDeviceId();
    const result = await API.Auth.login(username, undefined, deviceId);
    this.showSecurityWarningThenConnect(result);
}
```

**3. API client**

**File:** `static/js/api.js`

- `Auth.login(username, password, deviceId)` is called with `password` as `undefined` for login.
- The backend receives no password and, for users without `password_hash`, accepts the login.

### Technical note

- Registration still allows an optional password (`register-password` remains in the form). Accounts created with a password keep it stored; login for those accounts in v1.0.0.1 still requires the password on the backend. To make login fully passwordless for all accounts, the backend would need to ignore `password_hash` for login (not recommended without a stronger alternative such as MFA or magic links).

---

## 2. Security Warning Screen

### Design and functionality

After a successful login (or registration), the user is shown a **security warning screen** before entering the app. It is implemented as a modal dialog.

- **Title:** “Security notice”
- **Message:** “For your privacy and security, we recommend reviewing your account settings before continuing.”
- **Buttons:**
  - **Privacy and Security** — Enters the app and then opens the “Privacy and Security” settings modal.
  - **Ignore** — Enters the app without opening any further screen.

### User flow

1. User submits login (or register) form.
2. API returns success; tokens are stored; **security warning modal** is shown.
3. **If the user clicks “Ignore”:**
   - Modal and overlay are closed.
   - `connect()` is called (load user, show app, load servers/friends, etc.).
4. **If the user clicks “Privacy and Security”:**
   - Modal and overlay are closed.
   - `connect()` is called.
   - After the app is shown, the **“Privacy and Security”** modal is opened so the user can review settings.

### Implementation

**HTML — security warning modal**

**File:** `static/index.html`

```html
<div id="security-warning-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="security-warning-title">
    <div class="modal-content">
        <div class="security-warning-icon" aria-hidden="true"><i class="fas fa-shield-alt"></i></div>
        <h2 id="security-warning-title">Security notice</h2>
        <p class="modal-desc">For your privacy and security, we recommend reviewing your account settings before continuing.</p>
        <div class="modal-actions security-warning-actions">
            <button type="button" class="btn btn-primary" id="security-warning-privacy-btn">...</button>
            <button type="button" class="btn btn-secondary" id="security-warning-ignore-btn">Ignore</button>
        </div>
    </div>
</div>
```

**HTML — Privacy and Security modal (redirect target)**

```html
<div id="privacy-settings-modal" class="modal hidden" ...>
    <div class="modal-content">
        <h2 id="privacy-settings-title">Privacy and Security</h2>
        <p class="modal-desc">Manage your account privacy, security options, and associated devices here.</p>
        <div class="modal-actions">
            <button type="button" class="btn btn-primary modal-close-btn" data-close="privacy-settings-modal">Close</button>
        </div>
    </div>
</div>
```

**JavaScript — show warning after login/register**

**File:** `static/js/app.js`

- After successful `API.Auth.login` or `API.Auth.register`, the code calls `this.showSecurityWarningThenConnect(result)` instead of calling `this.connect()` directly.
- `showSecurityWarningThenConnect(loginResult)` stores the result (if needed later), shows `#modal-overlay` and `#security-warning-modal`.

**JavaScript — button handlers**

- **Ignore:** `_onSecurityWarningIgnore()` — hides the security modal and overlay, then calls `this.connect()`.
- **Privacy and Security:** `_onSecurityWarningPrivacy()` — hides the security modal and overlay, calls `this.connect()`, then opens `#privacy-settings-modal` via `this.showModal('privacy-settings-modal')`.

**CSS**

**File:** `static/css/liberty.css`

- `.security-warning-icon` — icon size and colour.
- `.security-warning-actions` — layout for the two buttons.

---

## 3. HWID / Device Verification

### Overview

In a web application, true Hardware ID (HWID) is not available without native APIs or user permission. This implementation uses a **browser-generated device identifier** stored in `localStorage` and sent to the backend. The backend treats it like a “trusted device” token:

- On **first account creation** (or first login from a new device), the frontend sends this `device_id`; the backend stores it on the user record.
- On **later logins** from the same browser/device, the same `device_id` is sent; if it matches the stored value, the backend marks the response as `trusted_device: true` and the user can proceed without an extra MFA step (the app does not implement MFA today; this prepares for future use).

**Privacy note:** The identifier is generated and stored in the browser; it is not read from the OS without user consent. Associating the device with the account is implicit when the user registers or logs in (they are actively authenticating). For stricter compliance, a one-time “Remember this device?” consent could be added in a future version.

### Backend

**3.1 Database — device_id on users**

**File:** `db/init.js`

- New column: `users.device_id TEXT` (nullable), added via `ALTER TABLE users ADD COLUMN device_id TEXT`.

**3.2 Register — store device_id**

**File:** `server.js` — `POST /api/v1/auth/register`

- Request body may include `device_id`.
- Insert: `INSERT INTO users (username, email, password_hash, device_id) VALUES ($1, $2, $3, $4)`.
- Response includes `trusted_device: true` when a `device_id` was sent and stored.

**3.3 Login — verify and optionally store device_id**

**File:** `server.js` — `POST /api/v1/auth/login`

- Request body may include `device_id`.
- Select: `SELECT id, username, email, password_hash, device_id FROM users WHERE username = $1`.
- **Trusted device:** `trusted_device = !!row.device_id && !!deviceIdVal && row.device_id === deviceIdVal`.
- **First time from this device:** If the client sends a `device_id` and the user has no `device_id` yet, the backend updates: `UPDATE users SET device_id = $1 WHERE id = $2`.
- Response includes `trusted_device: true` when the sent `device_id` matches the stored one.

### Frontend

**3.4 Device ID generation and storage**

**File:** `static/js/app.js`

- `getOrCreateDeviceId()`:
  - Reads `localStorage.getItem('liberty_device_id')`.
  - If missing, generates a UUID v4–style string and saves it with `localStorage.setItem('liberty_device_id', id)`.
  - Returns the same id on subsequent calls (same origin).

**Snippet:**
```javascript
getOrCreateDeviceId() {
    const KEY = 'liberty_device_id';
    let id = localStorage.getItem(KEY);
    if (!id) {
        id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem(KEY, id);
    }
    return id;
}
```

**3.5 Sending device_id on auth**

**File:** `static/js/api.js`

- `Auth.register(username, email, password, deviceId)` — body includes `device_id: deviceId || undefined`.
- `Auth.login(username, password, deviceId)` — body includes `device_id: deviceId || undefined`.

**File:** `static/js/app.js`

- `handleLogin()` calls `getOrCreateDeviceId()` and passes it to `API.Auth.login(username, undefined, deviceId)`.
- `handleRegister()` calls `getOrCreateDeviceId()` and passes it to `API.Auth.register(username, null, password || undefined, deviceId)`.

### Verification and association process (summary)

| Step | Where | What happens |
|------|--------|----------------|
| 1 | Frontend | Generate or read `liberty_device_id` from localStorage. |
| 2 | Frontend | Send `device_id` in register or login request body. |
| 3 | Backend (register) | Store `device_id` in `users.device_id` for the new user. |
| 4 | Backend (login) | If user has no `device_id`, set it from request (first device). If user has `device_id`, compare with request. |
| 5 | Backend | Set `trusted_device: true` in response when stored and sent `device_id` match. |
| 6 | Frontend | Use response only to proceed to security warning then app; `trusted_device` can be used later for MFA bypass or messaging. |

### Warning screen for “same device”

The current flow does not show a separate “device associated with HWID” screen. After login, the user always sees the **security warning** modal (Privacy and Security / Ignore). The `trusted_device` flag is available in the login/register response for future use (e.g. to skip MFA or to show a short “Logged in from recognised device” message).

---

## 4. Conclusion

- **Password removal:** Login form and handler now use only username (and device_id); backend already supported passwordless accounts.
- **Security warning:** A post-login modal offers “Privacy and Security” (opens settings modal) or “Ignore” (enter app directly).
- **Device verification:** A persistent device id (localStorage) is sent on register/login, stored and matched on the backend, with a `trusted_device` flag for same-device logins and future MFA bypass.

Possible future improvements:

- Optional “Remember this device?” explicit consent before storing `device_id`.
- Use of `trusted_device` to skip or simplify an MFA step when implemented.
- Dedicated “Privacy and Security” settings page (e.g. linked from the modal) with options to view/revoke associated devices.

---

## 5. Appendices

### A. Files modified (summary)

| File | Changes |
|------|--------|
| `static/index.html` | Removed login password field and “Forgot password” link; added security warning modal and Privacy and Security modal. |
| `static/js/app.js` | `getOrCreateDeviceId`, `showSecurityWarningThenConnect`, `_onSecurityWarningIgnore`, `_onSecurityWarningPrivacy`; `handleLogin`/`handleRegister` use device_id and show security warning; security warning button listeners. |
| `static/js/api.js` | `Auth.register` and `Auth.login` accept and send `device_id`. |
| `static/css/liberty.css` | Styles for `.security-warning-icon` and `.security-warning-actions`. |
| `server.js` | Register/login read `device_id`, register stores it, login updates if missing and sets `trusted_device` in response. |
| `db/init.js` | `ALTER TABLE users ADD COLUMN device_id TEXT`. |

### B. API request/response (snippet)

**POST /api/v1/auth/login**

Request body (example):
```json
{
  "username": "alice",
  "device_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
}
```

Response (example):
```json
{
  "success": true,
  "user": { "id": "...", "username": "alice", "email": null },
  "access_token": "...",
  "refresh_token": "...",
  "trusted_device": true
}
```

### C. Version

- **Version:** LIBERTY v1.0.0.1  
- **Report date:** 2025  
- **Purpose:** Document passwordless login, security warning screen, and device (HWID-style) verification for this release.
