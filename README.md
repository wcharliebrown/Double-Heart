# Zillow Double Heart

A Chrome extension that lets you heart Zillow property listings and attach personal notes, synced to your account on [doubleheart.sidebar.org](https://doubleheart.sidebar.org).

## What it does

While browsing Zillow property detail pages, a heart icon appears in the top-right corner of the browser window:

- **🤍** — property not yet hearted
- **❤️** — Double Heart: notes exist for this property
- **🖤** — Black Heart: ignore this property

Clicking the icon opens a form to add or edit notes for that property. Hearts and notes are saved to the DoubleHeart backend and associated with your account.

## How it works

- Injected as a content script on `https://www.zillow.com/*`
- Detects the Zillow property ID (`zpid`) from the URL
- Polls every second to handle Zillow's client-side navigation
- Authenticates via bearer token stored in `chrome.storage.local` (with `localStorage` as fallback)
- Communicates with three API endpoints on `doubleheart.sidebar.org`:
  - `POST /api/api-authenticate` — log in and receive a token
  - `GET /api/api-Get-Double-Hearts` — fetch heart status for a property
  - `POST /api/api-Save-Double-Hearts` — save heart and notes for a property

## Installation

1. Clone or download this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** and select this folder
5. Navigate to any Zillow property page — you'll be prompted to log in on first use

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome extension manifest (v3) |
| `content.js` | All extension logic — injected into Zillow pages |
| `reference/api_Get_Double_Hearts.inc.php` | Backend API reference (not part of the extension) |
| `reference/api_Save_Double_Hearts.inc.php` | Backend API reference (not part of the extension) |
| `reference/schema.txt` | Database schema for the backend (not part of the extension) |

## Permissions

- `scripting` — inject the content script
- `storage` — persist the auth token across sessions
- Host access to `zillow.com` and `doubleheart.sidebar.org`
