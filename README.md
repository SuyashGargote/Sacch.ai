# VeriGuard AI (Sacch.ai)

VeriGuard AI is a comprehensive intelligence portal designed to detect misinformation, financial fraud, and synthetic media (deepfakes). It leverages **Google Gemini 2.5** for reasoning and multi-modal analysis, combined with **VirusTotal** for threat intelligence and **Google Search** for real-time fact-checking.

## Features

### 1. Fact Verification Engine
*   **Hybrid Analysis**: Combines existing fact-checks from the Google Fact Check Tools API with live web grounding via Gemini.
*   **Verdict System**: Classifies claims as True, False, or Uncertain with detailed evidence and source citations.

### 2. Scam & Fraud Intelligence
*   **Phishing Detection**: Analyzes email text for social engineering patterns, urgency, and malicious intent.
*   **Malware Scanning**:
    *   **URL Scanner**: Checks website reputation against VirusTotal's database and Gemini's visual analysis.
    *   **File Analysis**: Calculates file hashes (SHA-256) client-side and verifies them against VirusTotal without uploading sensitive files to the server.

### 3. Deepfake & Synthetic Media Detector
*   **Multi-Modal Forensics**: Supports Image, Audio, and Video analysis.
*   **Artifact Detection**: Identifies visual anomalies (warping, lighting inconsistencies) and audio spectrum irregularities typical of AI-generated content.

### 4. Live Voice Assistant
*   **Real-time Interaction**: Speak naturally to the AI assistant to verify threats or ask security questions.
*   **Gemini Live API**: Utilizes low-latency streaming for a conversational experience.

---

## Configuration

To run this application, you need API keys for the AI models and threat intelligence services.

### 1. Get API Keys
*   **Google Gemini API Key**: [Get it from Google AI Studio](https://aistudio.google.com/)
    *   Required for: Fact checking, reasoning, deepfake analysis, and voice assistant.
    *   **Note**: Ensure you enable the "Google Search" tool in your project settings if required, or simply use a valid paid/free tier key.
*   **VirusTotal API Key**: [Get it from VirusTotal](https://www.virustotal.com/)
    *   Required for: URL and File hash scanning in the Scam Detector.
    *   Sign up for a free account to get a public API key (limited to 4 requests/min).

### 2. Environment Setup
Create a `.env` file in the root directory of your project. You can copy the structure below:

**File: `.env`**
```env
# Required for all AI features
API_KEY=your_google_gemini_api_key_here

# Required for Scam Detector (URL/File scanning)
VIRUSTOTAL_API_KEY=your_virustotal_api_key_here
```

> **Security Note**: Never commit your `.env` file to version control (git). Add it to your `.gitignore`.

---

## Running the Project Locally

This project is built with **React**, **TypeScript**, and **Tailwind CSS**.

### Prerequisites
*   Node.js (v18 or higher)
*   npm or yarn

### Steps

1.  **Clone the Repository**
    ```bash
    git clone <repository-url>
    cd sacch-ai
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Environment**
    Ensure you have created the `.env` file as described in the Configuration section above.

4.  **Start Development Server**
    ```bash
    npm run dev
    # or
    yarn dev
    ```
    The application will typically start at `http://localhost:5173` (if using Vite) or `http://localhost:3000`.

5.  **Build for Production**
    ```bash
    npm run build
    ```

## Tech Stack
*   **Frontend**: React 19, Lucide React (Icons)
*   **Styling**: Tailwind CSS
*   **AI SDK**: Google GenAI SDK (`@google/genai`)
*   **External APIs**: Google Fact Check Tools, VirusTotal v3 API

## Troubleshooting

*   **VirusTotal Limit**: If you see "Quota Exceeded" errors, remember that free VirusTotal keys are limited to 4 requests per minute.
*   **Microphone Access**: The Voice Assistant requires microphone permissions. Ensure your browser allows access to `localhost`.
*   **File Analysis**: The "File Scan" feature calculates the SHA-256 hash locally. The actual file is **never** uploaded to our servers or VirusTotal, preserving privacy.
