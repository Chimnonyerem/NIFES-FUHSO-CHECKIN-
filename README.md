# NIFES FUHSo Check-In App

A real-time gate attendance system for NIFES FUHSo powered by Firebase + React.

## Features
- 3 gates check in members simultaneously in real time
- Manual date selection for each attendance session
- Download attendance records as Excel (.xlsx)
- Permanent storage in Firebase Firestore
- Works on any phone browser

## How to Deploy

### 1. Push to GitHub
- Create a free account at github.com
- Create a new repository called `nifes-checkin`
- Upload all these files to the repository

### 2. Deploy on Vercel
- Go to vercel.com and sign up with your GitHub account
- Click "New Project" and select the `nifes-checkin` repository
- Click Deploy — Vercel handles everything automatically
- You'll get a live link like: https://nifes-checkin.vercel.app

### 3. Share the link
Send the link to all 3 gate attendants. Each opens it on their phone,
selects their gate, and starts checking in members.

## First Time Setup
1. Open the app
2. Go to ⚙️ Manage
3. Rename Gate A / B / C to your actual gate names
4. Add all your members' names
5. You're ready to go!
