# AI Digital Well-Being

A desktop-based digital productivity and career tracking application built with Electron.js.

The application monitors the user's active computer applications, categorizes activities into productive, learning, and distracting activities, tracks time spent, provides productivity statistics, and includes a Deep Work mode to help reduce distractions.

---

## 📌 Project Overview

AI Digital Well-Being is designed to help users understand and improve their digital habits.

The application runs as a desktop application and tracks the currently active window on the computer.

Activities are automatically categorized into:

- 🟢 Productive
- 🔵 Learning
- 🔴 Distraction

The application stores activity data locally and provides a dashboard where users can view their productivity statistics and career-related progress.

---

## ✨ Features

### 1. Activity Tracking

The application automatically detects the currently active application/window.

It tracks:

- Application name
- Active window title
- Category
- Time spent
- Date of activity

Activity tracking runs automatically in the background while the application is open.

---

### 2. Smart Activity Categorization

Activities are categorized based on keywords detected from the active application and window title.

#### Learning Activities

Examples:

- VS Code
- GitHub
- Programming
- Python
- Java
- HTML
- CSS
- React
- Node.js
- LeetCode
- HackerRank
- Documentation
- Stack Overflow

#### Distraction Activities

Examples:

- YouTube
- Netflix
- Instagram
- Facebook
- Reddit
- TikTok
- Gaming
- Twitch
- Movies
- Reels

#### Productive Activities

Activities that are not identified as learning or distraction are categorized as productive.

---

### 3. Deep Work Mode

Deep Work Mode helps users reduce distractions while working.

When Deep Work Mode is enabled:

- Distraction applications are detected.
- A blocking overlay can appear.
- The user receives a notification.
- Distraction activity is prevented from continuing normally through the application's focus mechanism.

Deep Work Mode can be turned ON or OFF from the application.

---

### 4. Productivity Dashboard

The dashboard provides an overview of the user's digital activity.

It can display:

- Productive time
- Learning time
- Distraction time
- Current active application
- Productivity statistics
- 7-day activity trends

---

### 5. Activity History

The History section allows users to view previously tracked activities.

It contains information such as:

- Application
- Category
- Duration
- Date

---

### 6. Career Progress / XP

The application calculates career-related progress using time spent on productive and learning activities.

Learning and productive activities contribute toward career XP.

This allows users to connect their daily computer usage with their learning and career goals.

---

### 7. Local Data Storage

Activity records are stored locally using NeDB.

The database is created automatically when the application starts.

Database location:

```text
Windows:
C:\Users\<YourUsername>\AppData\Roaming\Electron\career-tracker.db
