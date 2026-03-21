# LodgeGuard Management Console - Deployment Guide

This project is a full-stack management console for WireGuard automation, supporting both **Web** and **Windows Desktop** platforms.

## 🌐 Web Deployment
The application is already optimized for web hosting.
1.  Run `npm install`
2.  Run `npm run build`
3.  Deploy the contents of the `dist/` folder to any static hosting provider (Vercel, Netlify, Cloud Run, etc.).

## 🖥️ Windows Desktop App (Electron)
The project is pre-configured with Electron to run as a native Windows application.

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your Windows machine.

### Build Instructions
1.  **Unzip** this folder on your Windows computer.
2.  Open a terminal (PowerShell or CMD) in the project folder.
3.  Run the following commands:
    ```bash
    npm install
    npm run electron:build
    ```
4.  Once finished, your Windows installation package (`.exe`) will be located in the `dist-electron/` folder.

## 🔑 Environment Variables
Ensure you set your `GEMINI_API_KEY` in your deployment environment or a `.env` file for the AI features to work.

---
*Built with AI Studio Build*
